package com.planora.backend.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.planora.backend.dto.NotificationResponseDTO;
import com.planora.backend.model.Notification;
import com.planora.backend.model.User;
import com.planora.backend.repository.NotificationRepository;

import jakarta.persistence.EntityNotFoundException;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private NotificationService notificationService;

    private User recipient;

    @BeforeEach
    void setUp() {
        recipient = new User();
        recipient.setUserId(15L);
        recipient.setUsername("alice");
        recipient.setEmail("alice@example.com");
    }

    @Test
    void createNotification_persistsAndDispatchesRealtimeEvent() {
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification toSave = invocation.getArgument(0);
            toSave.setId(101L);
            return toSave;
        });

        notificationService.createNotification(recipient, "You were mentioned", "/project/8/chat");

        ArgumentCaptor<Notification> savedCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(savedCaptor.capture());
        Notification saved = savedCaptor.getValue();
        assertEquals(recipient, saved.getRecipient());
        assertEquals("You were mentioned", saved.getMessage());
        assertEquals("/project/8/chat", saved.getLink());
        assertFalse(saved.isRead());

        verify(messagingTemplate).convertAndSendToUser(
                eq("alice"),
                eq("/queue/notifications"),
                any(NotificationResponseDTO.class)
        );
    }

    @Test
    void createNotification_normalizesDestinationUsernameToLowercase() {
        recipient.setUsername("AliceMixedCase");

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification toSave = invocation.getArgument(0);
            toSave.setId(102L);
            return toSave;
        });

        notificationService.createNotification(recipient, "Realtime alert", "/project/10/chat");

        verify(messagingTemplate).convertAndSendToUser(
                eq("alicemixedcase"),
                eq("/queue/notifications"),
                any(NotificationResponseDTO.class)
        );
    }

    @Test
    void createNotificationIfNotDuplicate_createsWhenNoRecentDuplicate() {
        when(notificationRepository.existsByRecipientUserIdAndMessageAndLinkAndCreatedAtAfter(
                eq(15L), eq("New task assigned"), eq("/taskcard?taskId=10"), any(LocalDateTime.class)
        )).thenReturn(false);
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification toSave = invocation.getArgument(0);
            toSave.setId(111L);
            return toSave;
        });

        notificationService.createNotificationIfNotDuplicate(recipient, "New task assigned", "/taskcard?taskId=10");

        verify(notificationRepository).existsByRecipientUserIdAndMessageAndLinkAndCreatedAtAfter(
                eq(15L), eq("New task assigned"), eq("/taskcard?taskId=10"), any(LocalDateTime.class)
        );
        verify(notificationRepository).save(any(Notification.class));
        verify(messagingTemplate).convertAndSendToUser(eq("alice"), eq("/queue/notifications"), any(NotificationResponseDTO.class));
    }

    @Test
    void createNotificationIfNotDuplicate_skipsWhenDuplicateExists() {
        when(notificationRepository.existsByRecipientUserIdAndMessageAndLinkAndCreatedAtAfter(
                eq(15L), eq("Duplicate"), eq("/project/8/chat"), any(LocalDateTime.class)
        )).thenReturn(true);

        notificationService.createNotificationIfNotDuplicate(recipient, "Duplicate", "/project/8/chat");

        verify(notificationRepository, never()).save(any(Notification.class));
        verify(messagingTemplate, never()).convertAndSendToUser(anyString(), anyString(), any());
    }

    @Test
    void getUserNotifications_mapsEntitiesToDtos() {
        Notification first = new Notification();
        first.setId(1L);
        first.setRecipient(recipient);
        first.setMessage("m1");
        first.setLink("/l1");
        first.setRead(false);
        first.setCreatedAt(LocalDateTime.parse("2026-04-04T10:00:00"));

        Notification second = new Notification();
        second.setId(2L);
        second.setRecipient(recipient);
        second.setMessage("m2");
        second.setLink("/l2");
        second.setRead(true);
        second.setCreatedAt(LocalDateTime.parse("2026-04-04T09:00:00"));

        when(notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(15L)).thenReturn(List.of(first, second));

        List<NotificationResponseDTO> dtos = notificationService.getUserNotifications(15L);

        assertEquals(2, dtos.size());
        assertEquals(1L, dtos.get(0).getId());
        assertEquals("m1", dtos.get(0).getMessage());
        assertFalse(dtos.get(0).isRead());
        assertTrue(dtos.get(1).isRead());
    }

    @Test
    void markAsRead_updatesNotificationWhenOwnedByUser() {
        Notification notification = new Notification();
        notification.setId(80L);
        notification.setRecipient(recipient);
        notification.setRead(false);

        when(notificationRepository.findById(80L)).thenReturn(Optional.of(notification));

        notificationService.markAsRead(80L, 15L);

        assertTrue(notification.isRead());
        verify(notificationRepository).save(notification);
    }

    @Test
    void markAsRead_throwsWhenUserDoesNotOwnNotification() {
        Notification notification = new Notification();
        notification.setId(81L);
        notification.setRecipient(recipient);

        when(notificationRepository.findById(81L)).thenReturn(Optional.of(notification));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> notificationService.markAsRead(81L, 99L));
        assertEquals("Unauthorized", ex.getMessage());
        verify(notificationRepository, never()).save(any(Notification.class));
    }

    @Test
    void markAsRead_throwsWhenNotificationMissing() {
        when(notificationRepository.findById(anyLong())).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> notificationService.markAsRead(999L, 15L));
    }

    @Test
    void markAllAsRead_marksUnreadAndSavesAll() {
        Notification unread = new Notification();
        unread.setRecipient(recipient);
        unread.setRead(false);

        Notification read = new Notification();
        read.setRecipient(recipient);
        read.setRead(true);

        when(notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(15L)).thenReturn(List.of(unread, read));

        notificationService.markAllAsRead(15L);

        assertTrue(unread.isRead());
        assertTrue(read.isRead());
        verify(notificationRepository, times(1)).saveAll(List.of(unread));
    }
}
