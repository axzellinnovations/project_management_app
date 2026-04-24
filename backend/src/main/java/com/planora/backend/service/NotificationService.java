package com.planora.backend.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.dto.NotificationResponseDTO;
import com.planora.backend.model.Notification;
import com.planora.backend.model.User;
import com.planora.backend.repository.NotificationRepository;

import jakarta.persistence.EntityNotFoundException;

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Unconditionally creates and persists a notification.
     * Used by TaskService for task-assignment and comment events
     * (where duplicates are not a concern).
     */
    @Transactional
    public void createNotification(User recipient, String message, String link) {
        Notification notification = new Notification();
        notification.setRecipient(recipient);
        notification.setMessage(message);
        notification.setLink(link);
        notification.setRead(false);
        notification.setCreatedAt(LocalDateTime.now());
        notification = notificationRepository.save(notification);

        // Disptach via websocket for global realtime overlay
        NotificationResponseDTO dto = NotificationResponseDTO.builder()
                .id(notification.getId())
                .message(notification.getMessage())
                .link(notification.getLink())
                .isRead(notification.isRead())
                .createdAt(notification.getCreatedAt())
                .build();

        String destinationUsername = recipient.getUsername().toLowerCase(Locale.ROOT);
        messagingTemplate.convertAndSendToUser(
                destinationUsername,
                "/queue/notifications",
                dto
        );
    }

    /**
     * Creates a notification only if an identical one (same recipient, message,
     * and link) has NOT already been created within the last 60 seconds.
     *
     * This prevents duplicate notifications when chat events (DMs, @mentions)
     * may be triggered by multiple code paths for the same underlying message.
     */
    @Transactional
    public void createNotificationIfNotDuplicate(User recipient, String message, String link) {
        // Dedup window: 60 seconds
        LocalDateTime window = LocalDateTime.now().minusSeconds(60);
        createNotificationIfNotDuplicateSince(recipient, message, link, window);
    }

    /**
     * Creates a notification if no identical notification exists since {@code windowStart}.
     * Returns true when the notification was created, false when skipped as duplicate.
     */
    @Transactional
    public boolean createNotificationIfNotDuplicateSince(
            User recipient,
            String message,
            String link,
            LocalDateTime windowStart
    ) {
        boolean alreadyExists = notificationRepository
                .existsByRecipientUserIdAndMessageAndLinkAndCreatedAtAfter(
                        recipient.getUserId(), message, link, windowStart
                );
        if (alreadyExists) {
            return false;
        }
        createNotification(recipient, message, link);
        return true;
    }

    public List<NotificationResponseDTO> getUserNotifications(Long userId) {
        return notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(n -> NotificationResponseDTO.builder()
                        .id(n.getId())
                        .message(n.getMessage())
                        .link(n.getLink())
                        .isRead(n.isRead())
                        .createdAt(n.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    public long getUnreadCount(Long userId) {
        return notificationRepository.countByRecipientUserIdAndIsReadFalse(userId);
    }

    @Transactional
    public void markAsRead(Long notificationId, Long userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new EntityNotFoundException("Notification not found"));
        
        if (!notification.getRecipient().getUserId().equals(userId)) {
            throw new RuntimeException("Unauthorized");
        }
        
        notification.setRead(true);
        notificationRepository.save(notification);
    }

    @Transactional
    public void markAllAsRead(Long userId) {
        List<Notification> unread = notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(userId)
            .stream()
            .filter(n -> !n.isRead())
            .collect(Collectors.toList());
        
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }

    public void deleteNotification(Long id) {
        notificationRepository.deleteById(id);
    }
}
