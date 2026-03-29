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
import com.planora.backend.model.TeamInvitation;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.repository.TeamInvitationRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamInvitationController {
    private final TeamInvitationRepository teamInvitationRepository;

    @GetMapping("/{teamId}/pending-invites")
    public ResponseEntity<List<PendingInviteResponseDTO>> getPendingInvites(
            @PathVariable Long teamId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        // Only team members can view invites (reuse membership validation if needed)
        // teamMemberService.validateMembership(teamId, principal.getUserId());

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
