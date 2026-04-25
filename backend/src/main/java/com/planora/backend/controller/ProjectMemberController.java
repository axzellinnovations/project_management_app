package com.planora.backend.controller;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamInvitationRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.service.TeamMemberService;
import com.planora.backend.service.UserService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
@Slf4j
public class ProjectMemberController {
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final TeamInvitationRepository teamInvitationRepository;
    private final TaskRepository taskRepository;
    private final TeamMemberService teamMemberService;
    private final UserService userService;
    private final SimpMessagingTemplate simpMessagingTemplate;

    public enum MemberEventAction {
        MEMBER_JOINED,
        MEMBER_ROLE_CHANGED,
        ROLE_CHANGED,
        MEMBER_REMOVED
    }

    public static class MemberPayload {
        public Long userId;
        public String username;
        public String fullName;
        public String email;
        public String profilePicUrl;
        public String role;
        public Integer taskCount;
        public String status;

        public MemberPayload(Long userId, String username, String fullName, String email,
                             String profilePicUrl, String role, Integer taskCount, String status) {
            this.userId = userId;
            this.username = username;
            this.fullName = fullName;
            this.email = email;
            this.profilePicUrl = profilePicUrl;
            this.role = role;
            this.taskCount = taskCount;
            this.status = status;
        }
    }

    public static class MemberEvent {
        public MemberEventAction action;
        public Long userId;
        public String role;
        public String newRole;
        public MemberPayload member;

        public MemberEvent(MemberEventAction action, Long userId, String role, MemberPayload member) {
            this.action = action;
            this.userId = userId;
            this.role = role;
            this.newRole = role;
            this.member = member;
        }
    }

    public static class ChangeRoleRequest {
        public String role;
        public Long userId;
    }

    @GetMapping("/{projectId}/members")
    public ResponseEntity<List<TeamMemberResponseDTO>> getProjectMembers(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        Long teamId = project.getTeam().getId();
        Long projectOwnerUserId = project.getOwner().getUserId();
        Long currentUserId = principal.getUserId();
        teamMemberService.enforceCreatorOnlyOwnerRole(teamId, projectOwnerUserId);
        teamMemberService.validateMembership(teamId, currentUserId);
        List<TeamMember> members = teamMemberService.getTeamMembers(teamId);
        List<Long> userIds = members.stream()
                .map(member -> member.getUser() != null ? member.getUser().getUserId() : null)
                .filter(java.util.Objects::nonNull)
                .toList();
        Map<Long, Long> taskCountByUserId = userIds.isEmpty()
                ? Map.of()
                : taskRepository.countTasksByAssigneeUserIdsAndTeamId(userIds, teamId).stream()
                        .collect(Collectors.toMap(
                                row -> (Long) row[0],
                                row -> ((Number) row[1]).longValue()));
        List<TeamMemberResponseDTO> dtos = members.stream()
                .map(member -> TeamMemberResponseDTO.builder()
                        .id(member.getId())
                        .role(member.getRole().name())
                        .user(TeamMemberResponseDTO.UserInfo.builder()
                                .userId(member.getUser().getUserId())
                                .username(member.getUser().getUsername())
                                .fullName(member.getUser().getFullName())
                                .email(member.getUser().getEmail())
                                .profilePicUrl(userService.generatePresignedUrl(member.getUser().getProfilePicUrl()))
                                .build())
                        .lastActive(member.getUser().getLastActive())
                        .taskCount(taskCountByUserId.getOrDefault(member.getUser().getUserId(), 0L))
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
        Long projectOwnerUserId = project.getOwner().getUserId();
        Long currentUserId = principal.getUserId();
        teamMemberService.enforceCreatorOnlyOwnerRole(teamId, projectOwnerUserId);
        teamMemberService.validateMembership(teamId, currentUserId);
        List<TeamInvitation> invites = teamInvitationRepository.findByTeamIdAndStatus(teamId, "PENDING");
        sanitizePendingInviteOwnerRoles(invites, project.getOwner().getEmail());
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

        TeamMember previous = teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));
        TeamRole previousRole = previous.getRole();

        TeamMember updated = teamMemberService.changeMemberRoleWithPermissions(
                teamId,
                userId,
                request.role,
                currentUserId,
                projectId,
                project.getName(),
                project.getOwner().getUserId()
        );

        if (previousRole != updated.getRole()) {
            publishRoleChanged(projectId, userId, updated.getRole().name());
        }

        return ResponseEntity.ok().build();
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/{projectId}/members/{userId}")
    public ResponseEntity<?> removeMember(
            @PathVariable Long projectId,
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        Long teamId = project.getTeam().getId();
        Long currentUserId = principal.getUserId();
        teamMemberService.removeMemberWithPermissions(
                teamId,
                userId,
                currentUserId,
                projectId,
                                project.getName(),
                                project.getOwner().getUserId()
        );
        return ResponseEntity.ok().build();
    }

        private void sanitizePendingInviteOwnerRoles(List<TeamInvitation> invites, String creatorEmail) {
                if (invites == null || invites.isEmpty() || creatorEmail == null) {
                        return;
                }

                List<TeamInvitation> toUpdate = invites.stream()
                                .filter(invite -> invite.getRole() != null)
                                .filter(invite -> "OWNER".equalsIgnoreCase(invite.getRole()))
                                .filter(invite -> !creatorEmail.equalsIgnoreCase(invite.getEmail()))
                                .peek(invite -> invite.setRole("ADMIN"))
                                .toList();

                if (!toUpdate.isEmpty()) {
                        teamInvitationRepository.saveAll(toUpdate);
        }
        }

        private void publishRoleChanged(Long projectId, Long userId, String newRole) {
                try {
                        simpMessagingTemplate.convertAndSend(
                                        "/topic/project/" + projectId + "/members",
                                        new MemberEvent(MemberEventAction.ROLE_CHANGED, userId, newRole, null)
                        );
                } catch (RuntimeException ex) {
                        // Real-time delivery failures should not block the role change API response.
                        log.warn("Failed to publish role update for projectId={}, userId={}", projectId, userId, ex);
                }
        }
}
