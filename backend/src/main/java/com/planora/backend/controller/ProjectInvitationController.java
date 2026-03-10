package com.planora.backend.controller;

import com.planora.backend.dto.ProjectInviteRequest;
import com.planora.backend.service.ProjectInvitationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectInvitationController {

    private final ProjectInvitationService projectInvitationService;

    @PostMapping("/{projectId}/invitations")
    public ResponseEntity<?> inviteToProject(
            @PathVariable Long projectId,
            @RequestBody ProjectInviteRequest request,
            @AuthenticationPrincipal(expression = "userId") Long userId) {
        projectInvitationService.inviteToProject(projectId, request, userId);
        return ResponseEntity.ok("Invitation email sent");
    }

    @PostMapping("/invitations/accept")
    public ResponseEntity<?> acceptInvitation(
            @RequestBody java.util.Map<String, String> request,
            @AuthenticationPrincipal(expression = "userId") Long userId) {
        String token = request.get("token");
        projectInvitationService.acceptInvitation(token, userId);
        return ResponseEntity.ok("Invitation accepted successfully");
    }
}