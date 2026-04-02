package com.planora.backend.controller;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.planora.backend.dto.PendingInviteResponseDTO;
import com.planora.backend.dto.TeamMemberResponseDTO;
import com.planora.backend.model.Project;
import com.planora.backend.model.TeamInvitation;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamInvitationRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.NotificationService;
import com.planora.backend.service.TeamMemberService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectMemberController {

    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final TeamInvitationRepository teamInvitationRepository;
    private final TaskRepository taskRepository;
    private final TeamMemberService teamMemberService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    // ── Real-time: broadcast member-page events to viewers on the same page ───
    // Uses the existing STOMP broker (same /ws endpoint as chat) on topic
    // /topic/project/{projectId}/members so all connected clients update instantly.
    private final SimpMessagingTemplate simpMessagingTemplate;
    // ─────────────────────────────────────────────────────────────────────────

    /** Shape of events pushed to /topic/project/{projectId}/members */
    public enum MemberEventAction { ROLE_CHANGED, MEMBER_REMOVED, MEMBER_JOINED }

    public record MemberEvent(
            MemberEventAction action,
            Long userId,
            String newRole,          // populated for ROLE_CHANGED
            MemberPayload member     // populated for MEMBER_JOINED
    ) {}

    public record MemberPayload(
            Long userId,
            String username,
            String fullName,
            String email,
            String profilePicUrl,
            String role,
            int taskCount,
            String status
    ) {}

    public static class ChangeRoleRequest {
        public String role;
        public Long userId;
    }

    // ── Helper: broadcast an event to every client on this project's member page
    private void broadcastMemberEvent(Long projectId, MemberEvent event) {
        simpMessagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/members", event);
    }

    // ── Helper: resolve display name
    private String resolveDisplayName(Long userId) {
        return userRepository.findById(userId)
                .map(u -> u.getFullName() != null && !u.getFullName().isBlank()
                        ? u.getFullName() : u.getUsername())
                .orElse("A team admin");
    }

    @GetMapping("/{projectId}/members")
    public ResponseEntity<List<TeamMemberResponseDTO>> getProjectMembers(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        Long teamId = project.getTeam().getId();
        Long currentUserId = principal.getUserId();
        teamMemberService.validateMembership(teamId, currentUserId);
        List<TeamMember> members = teamMemberService.getTeamMembers(teamId);
        List<TeamMemberResponseDTO> dtos = members.stream()
                .map(member -> TeamMemberResponseDTO.builder()
                        .id(member.getId())
                        .role(member.getRole().name())
                        .user(TeamMemberResponseDTO.UserInfo.builder()
                                .userId(member.getUser().getUserId())
                                .username(member.getUser().getUsername())
                                .fullName(member.getUser().getFullName())
                                .email(member.getUser().getEmail())
                                .profilePicUrl(member.getUser().getProfilePicUrl())
                                .build())
                        .lastActive(member.getUser().getLastActive())
                        .taskCount(taskRepository.countByAssigneeAndProject_TeamId(member, teamId))
                        .status("Active")
                        .build())
                .collect(Collectors.toList());
        return new ResponseEntity<>(dtos, HttpStatus.OK);
    }

    @GetMapping("/{projectId}/pending-invites")
    public ResponseEntity<List<PendingInviteResponseDTO>> getProjectPendingInvites(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        Long teamId = project.getTeam().getId();
        Long currentUserId = principal.getUserId();
        teamMemberService.validateMembership(teamId, currentUserId);
        List<TeamInvitation> invites = teamInvitationRepository.findByTeamIdAndStatus(teamId, "PENDING");
        List<PendingInviteResponseDTO> dtos = invites.stream()
                .map(invite -> new PendingInviteResponseDTO(
                        invite.getId(),
                        invite.getEmail(),
                        invite.getInvitedAt(),
                        "Pending",
                        invite.getRole()
                ))
                .collect(Collectors.toList());
        return new ResponseEntity<>(dtos, HttpStatus.OK);
    }

    @PatchMapping("/{projectId}/members/{userId}/role")
    public ResponseEntity<?> changeMemberRole(
            @PathVariable Long projectId,
            @PathVariable Long userId,
            @RequestBody ChangeRoleRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        Long teamId = project.getTeam().getId();
        Long currentUserId = principal.getUserId();

        teamMemberService.changeMemberRoleWithPermissions(
                teamId, userId, request.role, currentUserId
        );

        // ── REAL-TIME: push ROLE_CHANGED to all members page viewers ─────────
        broadcastMemberEvent(projectId, new MemberEvent(
                MemberEventAction.ROLE_CHANGED,
                userId,
                request.role != null ? request.role.toUpperCase() : null,
                null
        ));
        // ─────────────────────────────────────────────────────────────────────

        // ── NOTIFICATION: tell the affected user their role changed ───────────
        if (!userId.equals(currentUserId)) {
            userRepository.findById(userId).ifPresent(targetUser -> {
                String changerName = resolveDisplayName(currentUserId);
                String newRole = request.role != null
                        ? request.role.substring(0, 1).toUpperCase()
                          + request.role.substring(1).toLowerCase()
                        : "Unknown";
                String message = changerName + " updated your role to " + newRole
                        + " in project \"" + project.getName() + "\"";
                notificationService.createNotification(targetUser, message, "/members/" + projectId);
            });
        }
        // ─────────────────────────────────────────────────────────────────────

        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{projectId}/members/{userId}")
    public ResponseEntity<?> removeMember(
            @PathVariable Long projectId,
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        Long teamId = project.getTeam().getId();
        Long currentUserId = principal.getUserId();

        User removedUser = !userId.equals(currentUserId)
                ? userRepository.findById(userId).orElse(null)
                : null;

        teamMemberService.removeMemberWithPermissions(teamId, userId, currentUserId);

        // ── REAL-TIME: push MEMBER_REMOVED to all members page viewers ────────
        broadcastMemberEvent(projectId, new MemberEvent(
                MemberEventAction.MEMBER_REMOVED,
                userId,
                null,
                null
        ));
        // ─────────────────────────────────────────────────────────────────────

        // ── NOTIFICATION: inform removed user ─────────────────────────────────
        if (removedUser != null) {
            String removerName = resolveDisplayName(currentUserId);
            String message = removerName + " removed you from project \""
                    + project.getName() + "\"";
            notificationService.createNotification(removedUser, message, "/dashboard");
        }
        // ─────────────────────────────────────────────────────────────────────

        return ResponseEntity.ok().build();
    }
}
