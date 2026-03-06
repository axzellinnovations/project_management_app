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
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProjectPageService {

    private final ProjectPageRepository repository;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;

    @Transactional
    public ProjectPage createPage(Long projectId, PageRequestDto request, Long userId) {
        Objects.requireNonNull(projectId, "projectId cannot be null");
        Objects.requireNonNull(userId, "userId cannot be null");

        Project project = findProject(projectId);
        validateProjectMembership(project.getTeam().getId(), userId, false);

        ProjectPage page = ProjectPage.builder()
                .projectId(projectId)
                .title(request.getTitle())
                .content(request.getContent())
                .build();

        return repository.save(page);
    }

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
        validateProjectMembership(project.getTeam().getId(), userId, true);

        existingPage.setTitle(request.getTitle());
        existingPage.setContent(request.getContent());

        ProjectPage updatedPage = repository.save(existingPage);

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
        validateProjectMembership(project.getTeam().getId(), userId, true);

        repository.delete(existingPage);
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
