package com.planora.backend.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.controller.ProjectMemberController;
import com.planora.backend.dto.ProjectInviteRequest;
import com.planora.backend.model.Project;
import com.planora.backend.model.TeamInvitation;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamInvitationRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProjectInvitationService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final TeamInvitationRepository teamInvitationRepository;
    private final TeamMemberService teamMemberService;
    private final TeamMemberRepository teamMemberRepository;
    private final EmailService emailService;
    private final NotificationService notificationService;
    private final UserService userService;

    // ── Real-time: broadcast MEMBER_JOINED to members page viewers ────────────
    // Uses the same STOMP broker as the chat system (/ws endpoint).
    private final SimpMessagingTemplate simpMessagingTemplate;
    // ─────────────────────────────────────────────────────────────────

    @Transactional
    public void inviteToProject(Long projectId, ProjectInviteRequest request, Long inviterUserId) {
        if (request == null) {
            throw new RuntimeException("Invite request is required");
        }

        String inviteeEmail = request.getEmail().trim().toLowerCase();
        TeamRole inviteRole = request.getRole();
        String roleStr = inviteRole.name();

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        Long teamId = project.getTeam().getId();
        Long projectOwnerUserId = project.getOwner().getUserId();
        String projectOwnerEmail = project.getOwner().getEmail();

        teamMemberService.enforceCreatorOnlyOwnerRole(teamId, projectOwnerUserId);

        // Allow TEAM OWNER and ADMIN to invite
        teamMemberService.validateOwnerOrAdmin(teamId, inviterUserId);

        if (inviteRole == TeamRole.OWNER && !inviteeEmail.equalsIgnoreCase(projectOwnerEmail)) {
            throw new AccessDeniedException("Only the project creator can hold OWNER role");
        }


        // Block if user is already a member
        userRepository.findByEmailIgnoreCase(inviteeEmail).ifPresent(existingUser -> {
            teamMemberRepository.findByTeamIdAndUserUserId(teamId, existingUser.getUserId())
                .ifPresent(member -> {
                    throw new RuntimeException("This user is already a member of the project.");
                });
        });

        // Block if already invited and not expired (pending)
        List<TeamInvitation> existingInvitations = teamInvitationRepository.findByTeamIdAndEmail(teamId, inviteeEmail);
        for (TeamInvitation existing : existingInvitations) {
            if ((existing.getStatus() == null || existing.getStatus().equalsIgnoreCase("PENDING")) &&
                (existing.getExpiresAt() == null || existing.getExpiresAt().isAfter(LocalDateTime.now()))) {
                throw new RuntimeException("Invitation already sent to this email");
            }
        }

        User inviter = userRepository.findById(inviterUserId)
                .orElseThrow(() -> new RuntimeException("Inviter not found"));

        // Save invitation (token generated even though we are not sending link yet)
        TeamInvitation invitation = new TeamInvitation();
        invitation.setEmail(inviteeEmail);
        invitation.setTeam(project.getTeam());
        invitation.setToken(UUID.randomUUID().toString());
        invitation.setInvitedAt(LocalDateTime.now());
        invitation.setExpiresAt(LocalDateTime.now().plusDays(7));
        invitation.setStatus("PENDING");
        invitation.setRole(roleStr);

        teamInvitationRepository.save(invitation);

        // Email content (no link)
        String inviterName = (inviter.getFullName() != null && !inviter.getFullName().isBlank())
                ? inviter.getFullName()
                : (inviter.getUsername() != null && !inviter.getUsername().isBlank())
                        ? inviter.getUsername()
                        : inviter.getEmail();

        emailService.sendProjectInvitationHtmlEmail(inviteeEmail, inviterName, project.getName(),
                invitation.getToken());
    }

    @Transactional
    public void acceptInvitation(String token, Long userId) {
        if (token == null || token.isBlank()) {
            throw new RuntimeException("Invalid invitation token");
        }

        TeamInvitation invitation = teamInvitationRepository.findByToken(token)
                .orElseThrow(() -> new RuntimeException("Invitation not found or invalid"));

        Project project = invitation.getTeam().getProjects().stream().findFirst().orElse(null);
        Long projectOwnerUserId = (project != null && project.getOwner() != null)
            ? project.getOwner().getUserId()
            : null;

        teamMemberService.enforceCreatorOnlyOwnerRole(invitation.getTeam().getId(), projectOwnerUserId);

        if (invitation.getExpiresAt() != null && invitation.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Invitation has expired");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Only allow if email matches (optional safety check, but user could have
        // signed up with this email)
        if (!user.getEmail().equalsIgnoreCase(invitation.getEmail())) {
            throw new RuntimeException("This invitation was sent to a different email address");
        }

        // Prevent duplicate membership
        teamMemberRepository.findByTeamIdAndUserUserId(invitation.getTeam().getId(), userId)
                .ifPresent(m -> {
                    throw new RuntimeException("You are already a member of this team");
                });

        // Debug logging for investigation
        System.out.println("[DEBUG] Accepting invitation:");
        System.out.println("  Token: " + token);
        System.out.println("  Invitation ID: " + invitation.getId());
        System.out.println("  Invitation Role: '" + invitation.getRole() + "'");

        TeamMember member = new TeamMember();
        member.setTeam(invitation.getTeam());
        member.setUser(user);
        // Use the invited role, robust to case/whitespace
        TeamRole invitedRole;
        try {
            String roleStr = invitation.getRole();
            if (roleStr != null) {
                roleStr = roleStr.trim().toUpperCase();
            }
            invitedRole = TeamRole.valueOf(roleStr);
        } catch (Exception e) {
            System.out.println("[DEBUG] Invalid role, defaulting to MEMBER");
            invitedRole = TeamRole.MEMBER; // fallback
        }

        if (invitedRole == TeamRole.OWNER && (projectOwnerUserId == null || !projectOwnerUserId.equals(userId))) {
            invitedRole = TeamRole.ADMIN;
        }

        member.setRole(invitedRole);
        System.out.println("  Assigned TeamMember Role: '" + invitedRole + "'");
        teamMemberRepository.save(member);

        invitation.setStatus("ACCEPTED");
        teamInvitationRepository.save(invitation);

        // ── NOTIFICATION: tell OWNERs and ADMINs that someone joined ──────────
        String joinerName = (user.getFullName() != null && !user.getFullName().isBlank())
                ? user.getFullName()
                : (user.getUsername() != null && !user.getUsername().isBlank())
                        ? user.getUsername()
                        : user.getEmail();

        String projectName = project != null ? project.getName() : "your project";
        String projectId = project != null && project.getId() != null ? String.valueOf(project.getId()) : "";

        String message = joinerName + " accepted your invitation and joined project \""
                + projectName + "\"";
        String link = "/members/" + projectId;

        List<TeamMember> currentMembers = teamMemberRepository.findByTeamId(invitation.getTeam().getId());
        currentMembers.stream()
                .filter(m -> m.getRole() == TeamRole.OWNER || m.getRole() == TeamRole.ADMIN)
                .filter(m -> !m.getUser().getUserId().equals(userId))
                .forEach(m -> notificationService.createNotification(m.getUser(), message, link));
        // ─────────────────────────────────────────────────────────────────────

        // ── REAL-TIME: push MEMBER_JOINED to all members page viewers ─────────
        // Broadcast the new member's full profile so the UI can append them
        // to the list without needing a page refresh.
        if (!projectId.isEmpty()) {
            var memberPayload = new ProjectMemberController.MemberPayload(
                    user.getUserId(),
                    user.getUsername(),
                    user.getFullName(),
                    user.getEmail(),
                    userService.generatePresignedUrl(user.getProfilePicUrl()),
                    invitedRole.name(),
                    0,        // task count starts at 0 for a brand-new member
                    "Active"
            );
            simpMessagingTemplate.convertAndSend(
                    "/topic/project/" + projectId + "/members",
                    new ProjectMemberController.MemberEvent(
                            ProjectMemberController.MemberEventAction.MEMBER_JOINED,
                            user.getUserId(),
                            invitedRole.name(),
                            memberPayload
                    )
            );
        }
        // ─────────────────────────────────────────────────────────────────────
    }
}