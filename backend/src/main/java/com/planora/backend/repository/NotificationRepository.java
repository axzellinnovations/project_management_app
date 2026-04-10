package com.planora.backend.repository;

import com.planora.backend.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByRecipientUserIdOrderByCreatedAtDesc(Long userId);
    long countByRecipientUserIdAndIsReadFalse(Long userId);

    /**
     * Duplicate-prevention guard: returns true if an identical notification
     * (same recipient, message text, and deep-link) already exists within the
     * supplied time window.  Used by NotificationService to de-duplicate chat
     * mentions and DM alerts that could otherwise fire multiple times for a
     * single message event.
     */
    boolean existsByRecipientUserIdAndMessageAndLinkAndCreatedAtAfter(
            Long userId, String message, String link, LocalDateTime after
    );
}
