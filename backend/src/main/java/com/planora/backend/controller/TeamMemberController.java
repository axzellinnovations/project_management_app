package com.planora.backend.controller;

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
    public ResponseEntity<List<TeamMember>> getTeamMembers(
            @PathVariable Long teamId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Long currentUserId = principal.getUserId();

        // Only team members can view members
        teamMemberService.validateMembership(teamId, currentUserId);

        return new ResponseEntity<>(
                teamMemberService.getTeamMembers(teamId),
                HttpStatus.OK
        );
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
