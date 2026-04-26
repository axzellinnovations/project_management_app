// REST controller exposing endpoints for user notifications under /api/notifications; delegates logic to NotificationService.
package com.planora.backend.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.planora.backend.dto.NotificationResponseDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.NotificationService;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    // ---------------- GET NOTIFICATIONS ----------------

    // Retrieves all notifications for the currently authenticated user.
    @GetMapping
    public ResponseEntity<List<NotificationResponseDTO>> getUserNotifications(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(notificationService.getUserNotifications(principal.getUserId()));
    }

    // Retrieves the count of unread notifications for the user.
    @GetMapping("/unread-count")
    public ResponseEntity<?> getUnreadCount(@AuthenticationPrincipal UserPrincipal principal) {
        long count = notificationService.getUnreadCount(principal.getUserId());
        return ResponseEntity.ok(Map.of("count", count));
    }

    // ---------------- UPDATE NOTIFICATION STATUS ----------------

    // Marks a specific notification as read.
    @PatchMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal) {
        notificationService.markAsRead(id, principal.getUserId());
        return ResponseEntity.ok().build();
    }

    // Marks all notifications as read for the currently authenticated user.
    @PatchMapping("/read-all")
    public ResponseEntity<?> markAllAsRead(@AuthenticationPrincipal UserPrincipal principal) {
        notificationService.markAllAsRead(principal.getUserId());
        return ResponseEntity.ok().build();
    }

    // ---------------- DELETE NOTIFICATION ----------------

    // Deletes a specific notification by its ID.
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNotification(@PathVariable Long id) {
        notificationService.deleteNotification(id);
        return ResponseEntity.noContent().build();
    }
}
