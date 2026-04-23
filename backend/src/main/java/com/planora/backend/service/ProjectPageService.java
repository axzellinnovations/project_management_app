package com.planora.backend.service;

import com.planora.backend.dto.PageDetailResponseDto;
import com.planora.backend.dto.PageRequestDto;
import com.planora.backend.dto.PageSummaryResponseDto;
import com.planora.backend.model.Project;
import com.planora.backend.model.ProjectPage;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.repository.ProjectPageRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

// Manages rich-text documentation pages (like a Wiki) attached to a Project.
@Service
@RequiredArgsConstructor
public class ProjectPageService {

    private final ProjectPageRepository repository;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional
    public ProjectPage createPage(Long projectId, PageRequestDto request, Long userId) {
        // Defensive Programming: Fail immediately if someone passes bad data internally.
        Objects.requireNonNull(projectId, "projectId cannot be null");
        Objects.requireNonNull(userId, "userId cannot be null");

        // Step 1: Verify the project exists.
        Project project = findProject(projectId);

        // Step 2: Validate the user is actually in the project (Viewers are allowed to create pages).
        validateProjectMembership(project.getTeam().getId(), userId, false);

        // Step 3: Map data and save. We track who created it and who last updated it
        // to manage notifications later.
        ProjectPage page = ProjectPage.builder()
                .projectId(projectId)
                .title(request.getTitle())
                .content(request.getContent())
            .createdByUserId(userId)
            .updatedByUserId(userId)
                .build();

        ProjectPage saved = repository.save(page);

        // Step 4: Alert management that documentation is being added to their project.
        notifyProjectOwnersAndAdminsOnCreate(project, userId, saved);
        return saved;
    }

    /*
     * Retrieves a lightweight list of pages for the sidebar navigation.
     * We purposefully DO NOT load the `content` field here to save database memory and bandwidth.
     */
    @Transactional(readOnly = true)
    public List<PageSummaryResponseDto> getProjectPages(Long projectId, Long userId) {
        Objects.requireNonNull(projectId, "projectId cannot be null");
        Objects.requireNonNull(userId, "userId cannot be null");

        Project project = findProject(projectId);
        validateProjectMembership(project.getTeam().getId(), userId, false);

        return repository.findByProjectId(projectId).stream()
                .map(this::toSummaryDto)
                .collect(Collectors.toList());
    }

    /*
     * Retrieves the full rich-text content of a specific page when the user clicks on it.
     */
    @Transactional(readOnly = true)
    public PageDetailResponseDto getPageById(Long pageId, Long userId) {
        Objects.requireNonNull(pageId, "pageId cannot be null");
        Objects.requireNonNull(userId, "userId cannot be null");

        ProjectPage page = findPage(pageId);
        Project project = findProject(page.getProjectId());
        validateProjectMembership(project.getTeam().getId(), userId, false);

        PageDetailResponseDto dto = new PageDetailResponseDto();
        dto.setId(page.getId());
        dto.setTitle(page.getTitle());
        dto.setContent(page.getContent());
        dto.setUpdatedAt(page.getUpdatedAt().toString());

        return dto;
    }

    @Transactional
    public PageDetailResponseDto updatePage(Long pageId, PageRequestDto request, Long userId) {
        Objects.requireNonNull(pageId, "pageId cannot be null");
        Objects.requireNonNull(userId, "userId cannot be null");

        ProjectPage existingPage = findPage(pageId);
        Project project = findProject(existingPage.getProjectId());

        // Security Check: Viewers can read pages, but they cannot edit them.
        validateProjectMembership(project.getTeam().getId(), userId, true);

        // Step 1: Snapshot old data to determine if we need to send notifications.
        String oldTitle = existingPage.getTitle();
        Long oldUpdatedByUserId = existingPage.getUpdatedByUserId();

        // Step 2: Apply updates.
        existingPage.setTitle(request.getTitle());
        existingPage.setContent(request.getContent());
        existingPage.setUpdatedByUserId(userId);

        ProjectPage updatedPage = repository.save(existingPage);

        // Step 3: Only alert stakeholders if the TITLE changed.
        // We don't want to spam notifications every time someone fixes a typo in the content.
        if (!Objects.equals(oldTitle, updatedPage.getTitle())) {
            notifyImpactedStakeholdersOnRename(project, updatedPage, userId, oldTitle, oldUpdatedByUserId);
        }

        PageDetailResponseDto dto = new PageDetailResponseDto();
        dto.setId(updatedPage.getId());
        dto.setTitle(updatedPage.getTitle());
        dto.setContent(updatedPage.getContent());

        if (updatedPage.getUpdatedAt() != null) {
            dto.setUpdatedAt(updatedPage.getUpdatedAt().toString());
        }

        return dto;
    }

    @Transactional
    public void deletePage(Long pageId, Long userId) {
        Objects.requireNonNull(pageId, "pageId cannot be null");
        Objects.requireNonNull(userId, "userId cannot be null");

        ProjectPage existingPage = findPage(pageId);
        Project project = findProject(existingPage.getProjectId());

        // Viewers cannot delete pages.
        validateProjectMembership(project.getTeam().getId(), userId, true);

        // Notify people who wrote/edited this page BEFORE we delete it from the DB.
        notifyImpactedStakeholdersOnDelete(project, existingPage, userId);

        repository.delete(existingPage);
    }

    // ── Notification Strategies ───────────────────────────────────────────────────

    /*
     * Alert Strategy: "Managerial Oversight"
     * When a page is created, we only notify Owners and Admins, keeping regular Members focused on their tasks.
     */
    private void notifyProjectOwnersAndAdminsOnCreate(Project project, Long actorUserId, ProjectPage page) {
        Set<TeamRole> roles = Set.of(TeamRole.OWNER, TeamRole.ADMIN);
        List<TeamMember> recipients = teamMemberRepository
                .findByTeamIdAndRoleIn(project.getTeam().getId(), roles);

        String actorName = resolveActorName(actorUserId);
        String message = actorName + " created page: " + page.getTitle();
        String link = "/pages/" + page.getId() + "?projectId=" + project.getId();

        recipients.stream()
                .map(TeamMember::getUser)
                .filter(Objects::nonNull)
                .filter(user -> !user.getUserId().equals(actorUserId))
                .forEach(user -> notificationService.createNotification(user, message, link));
    }

    /*
     * Alert Strategy: "Direct Stakeholders"
     * If a page is renamed, we only notify the person who originally created it,
     * and the person who last edited it. We don't spam the whole team.
     */
    private void notifyImpactedStakeholdersOnRename(Project project,
                                                    ProjectPage page,
                                                    Long actorUserId,
                                                    String oldTitle,
                                                    Long oldUpdatedByUserId) {
        Set<Long> recipientIds = new LinkedHashSet<>();
        if (page.getCreatedByUserId() != null) {
            recipientIds.add(page.getCreatedByUserId());
        }
        if (oldUpdatedByUserId != null) {
            recipientIds.add(oldUpdatedByUserId);
        }

        recipientIds.remove(actorUserId);
        if (recipientIds.isEmpty()) {
            return;
        }

        String actorName = resolveActorName(actorUserId);
        String before = oldTitle != null ? oldTitle : "Untitled";
        String after = page.getTitle() != null ? page.getTitle() : "Untitled";
        String message = actorName + " renamed page from \"" + before + "\" to \"" + after + "\"";
        String link = "/pages/" + page.getId() + "?projectId=" + project.getId();

        notifyUsersByIds(recipientIds, message, link);
    }

    /*
     * Alert Strategy: "Direct Stakeholders"
     * Tells the creator and last editor that their work has been deleted.
     */
    private void notifyImpactedStakeholdersOnDelete(Project project, ProjectPage page, Long actorUserId) {
        Set<Long> recipientIds = new LinkedHashSet<>();
        if (page.getCreatedByUserId() != null) {
            recipientIds.add(page.getCreatedByUserId());
        }
        if (page.getUpdatedByUserId() != null) {
            recipientIds.add(page.getUpdatedByUserId());
        }

        recipientIds.remove(actorUserId);
        if (recipientIds.isEmpty()) {
            return;
        }

        String actorName = resolveActorName(actorUserId);
        String message = actorName + " deleted page: " + page.getTitle();
        String link = "/pages?projectId=" + project.getId();
        notifyUsersByIds(recipientIds, message, link);
    }

    // ── Internal Helpers ──────────────────────────────────────────────────────────

    // Resolves the display name for notifications, preferring Full Name over Username.
    private String resolveActorName(Long actorUserId) {
        return userRepository.findById(actorUserId)
                .map(user -> user.getFullName() != null && !user.getFullName().isBlank()
                        ? user.getFullName()
                        : user.getUsername())
                .orElse("A team member");
    }

    private void notifyUsersByIds(Set<Long> recipientIds, String message, String link) {
        userRepository.findAllById(recipientIds)
                .forEach(user -> notificationService.createNotification(user, message, link));
    }

    private ProjectPage findPage(Long pageId) {
        Objects.requireNonNull(pageId, "pageId cannot be null");
        return repository.findById(pageId)
                .orElseThrow(() -> new EntityNotFoundException("Page not found with ID: " + pageId));
    }

    private Project findProject(Long projectId) {
        Objects.requireNonNull(projectId, "projectId cannot be null");
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new EntityNotFoundException("Project not found with ID: " + projectId));
    }

    /*
     * RBAC helper.
     * @param denyViewer If true, users with the "VIEWER" role will trigger an AccessDeniedException.
     */
    private void validateProjectMembership(Long teamId, Long userId, boolean denyViewer) {
        TeamMember member = teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new AccessDeniedException("User is not a member of this team"));

        if (denyViewer && member.getRole() == TeamRole.VIEWER) {
            throw new AccessDeniedException("Insufficient permission for this action");
        }
    }

    private PageSummaryResponseDto toSummaryDto(ProjectPage page) {
        PageSummaryResponseDto dto = new PageSummaryResponseDto();
        dto.setId(page.getId());
        dto.setTitle(page.getTitle());
        return dto;
    }
}
