package com.planora.backend.controller;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
                .map(invite -> PendingInviteResponseDTO.builder()
                        .id(invite.getId())
                        .email(invite.getEmail())
                        .invitedAt(invite.getInvitedAt())
                        .status("Pending")
                        .build())
                .collect(Collectors.toList());
        return new ResponseEntity<>(dtos, HttpStatus.OK);
    }
}
