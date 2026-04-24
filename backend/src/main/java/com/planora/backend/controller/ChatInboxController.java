package com.planora.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.planora.backend.service.ChatInboxService;

import lombok.RequiredArgsConstructor;

@RestController
@CrossOrigin(origins = "http://localhost:3000")
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatInboxController {

    private final ChatInboxService chatInboxService;

    @GetMapping("/inbox")
    public ResponseEntity<ChatInboxService.ChatInboxResponse> getInbox(
            @AuthenticationPrincipal(expression = "userId") Long userId,
            Authentication authentication,
            @RequestParam(defaultValue = "20") int projectLimit,
            @RequestParam(defaultValue = "100") int activityLimit,
            @RequestParam(defaultValue = "all") String status
    ) {
        // Keep filtering strict and predictable for clients by normalizing unsupported values.
        String normalizedStatus = status == null ? "all" : status.trim().toLowerCase();
        if (!"all".equals(normalizedStatus) && !"unread".equals(normalizedStatus)) {
            normalizedStatus = "all";
        }

        // Defensive caps prevent expensive inbox fan-out on accidental large query params.
        int normalizedProjectLimit = projectLimit <= 0 ? 0 : Math.min(projectLimit, 500);
        int normalizedActivityLimit = activityLimit <= 0 ? 1 : Math.min(activityLimit, 1000);
        if (userId == null || authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            return ResponseEntity.status(401).build();
        }
        String username = authentication.getName();

        return ResponseEntity.ok(
                chatInboxService.getInbox(
                userId,
                        username,
                        normalizedProjectLimit,
                        normalizedActivityLimit,
                        normalizedStatus
                )
        );
    }
}
