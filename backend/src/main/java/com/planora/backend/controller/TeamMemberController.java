package com.planora.backend.controller;

import com.planora.backend.dto.TeamMemberResponseDTO;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.TeamMemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamMemberController {

    private final TeamMemberService teamMemberService;

    // ---------------- ADD MEMBER TO TEAM (OWNER ONLY) ----------------
    @PostMapping("/{teamId}/members/{userId}")
    public ResponseEntity<TeamMember> addMember(
            @PathVariable Long teamId,
            @PathVariable Long userId,
            @RequestParam TeamRole role,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Long currentUserId = principal.getUserId();

        return new ResponseEntity<>(
                teamMemberService.addMember(
                        teamId,
                        userId,
                        role,
                        currentUserId
                ),
                HttpStatus.CREATED
        );
    }

    // ---------------- GET ALL MEMBERS OF A TEAM ----------------
    @GetMapping("/{teamId}/members")
    public ResponseEntity<List<TeamMemberResponseDTO>> getTeamMembers(
            @PathVariable Long teamId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Long currentUserId = principal.getUserId();

        // Only team members can view members
        teamMemberService.validateMembership(teamId, currentUserId);

        List<TeamMemberResponseDTO> dtos = teamMemberService.getTeamMembers(teamId)
                .stream()
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
                        .build())
                .toList();

        return new ResponseEntity<>(dtos, HttpStatus.OK);
    }

    // ---------------- UPDATE MEMBER ROLE (OWNER ONLY) ----------------
    @PutMapping("/{teamId}/members/{userId}/role")
    public ResponseEntity<TeamMember> updateMemberRole(
            @PathVariable Long teamId,
            @PathVariable Long userId,
            @RequestParam TeamRole role,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Long currentUserId = principal.getUserId();

        return new ResponseEntity<>(
                teamMemberService.updateMemberRole(teamId, userId, role, currentUserId),
                HttpStatus.OK
        );
    }

    // ---------------- REMOVE MEMBER FROM TEAM (OWNER ONLY) ----------------
    @DeleteMapping("/{teamId}/members/{userId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable Long teamId,
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        Long currentUserId = user.getUserId();

        teamMemberService.removeMember(teamId, userId, currentUserId);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }
}
