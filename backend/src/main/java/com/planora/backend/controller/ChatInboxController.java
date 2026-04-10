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
        String normalizedStatus = status == null ? "all" : status.trim().toLowerCase();
        if (!"all".equals(normalizedStatus) && !"unread".equals(normalizedStatus)) {
            normalizedStatus = "all";
        }

        int normalizedProjectLimit = Math.min(Math.max(projectLimit, 1), 100);
        int normalizedActivityLimit = Math.min(Math.max(activityLimit, 1), 500);
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
