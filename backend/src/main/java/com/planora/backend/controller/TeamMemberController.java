// REST controller exposing team membership endpoints under /api/teams; delegates all business logic to TeamMemberService.
package com.planora.backend.controller;

import com.planora.backend.dto.TeamMemberResponseDTO;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.TeamMemberService;
import com.planora.backend.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamMemberController {

        private final TeamMemberService teamMemberService;

        @Autowired
        private TaskRepository taskRepository;

        // ---------------- ADD MEMBER TO TEAM (OWNER ONLY) ----------------
        @PostMapping("/{teamId}/members/{userId}")
        public ResponseEntity<TeamMember> addMember(
                        @PathVariable Long teamId,
                        @PathVariable Long userId,
                        @RequestParam TeamRole role,
                        @AuthenticationPrincipal UserPrincipal principal) {
                Long currentUserId = principal.getUserId();

                return new ResponseEntity<>(
                                teamMemberService.addMember(
                                                teamId,
                                                userId,
                                                role,
                                                currentUserId),
                                HttpStatus.CREATED);
        }

        // ---------------- GET ALL MEMBERS OF A TEAM ----------------
        @GetMapping("/{teamId}/members")
        @Transactional(readOnly = true)
        public ResponseEntity<List<TeamMemberResponseDTO>> getTeamMembers(
                        @PathVariable Long teamId,
                        @AuthenticationPrincipal UserPrincipal principal) {
                Long currentUserId = principal.getUserId();

                // Only team members can view members
                teamMemberService.validateMembership(teamId, currentUserId);

                List<TeamMember> members = teamMemberService.getTeamMembers(teamId);
        // Collects task counts per user so the members page can display workload alongside the member list.
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
                                                                .profilePicUrl(member.getUser().getProfilePicUrl())
                                                                .build())
                                                .lastActive(member.getUser().getLastActive())
                                                .taskCount(taskCountByUserId.getOrDefault(member.getUser().getUserId(),
                                                                0L))
                                                .status("Active")
                                                .build())
                                .toList();

                return new ResponseEntity<>(dtos, HttpStatus.OK);
        }

        // Update member role — restricted to OWNER only; delegates enforcement to service layer.
        // ---------------- UPDATE MEMBER ROLE (OWNER ONLY) ----------------
        @PutMapping("/{teamId}/members/{userId}/role")
        public ResponseEntity<TeamMember> updateMemberRole(
                        @PathVariable Long teamId,
                        @PathVariable Long userId,
                        @RequestParam TeamRole role,
                        @AuthenticationPrincipal UserPrincipal principal) {
                Long currentUserId = principal.getUserId();

                return new ResponseEntity<>(
                                teamMemberService.updateMemberRole(teamId, userId, role, currentUserId),
                                HttpStatus.OK);
        }

        // ---------------- REMOVE MEMBER FROM TEAM (OWNER ONLY) ----------------
        @DeleteMapping("/{teamId}/members/{userId}")
        public ResponseEntity<Void> removeMember(
                        @PathVariable Long teamId,
                        @PathVariable Long userId,
                        @AuthenticationPrincipal UserPrincipal user) {
                Long currentUserId = user.getUserId();

                teamMemberService.removeMember(teamId, userId, currentUserId);
                return new ResponseEntity<>(HttpStatus.NO_CONTENT);
        }
}
