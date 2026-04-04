package com.planora.backend.controller;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamInvitationRepository;
import com.planora.backend.repository.TeamMemberRepository;
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

        public enum MemberEventAction {
                MEMBER_JOINED,
                MEMBER_ROLE_CHANGED,
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
                public MemberPayload member;

                public MemberEvent(MemberEventAction action, Long userId, String role, MemberPayload member) {
                        this.action = action;
                        this.userId = userId;
                        this.role = role;
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
                teamId, userId, currentUserId
        );
        return ResponseEntity.ok().build();
    }
}
