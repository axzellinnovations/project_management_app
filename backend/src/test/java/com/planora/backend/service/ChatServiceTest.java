package com.planora.backend.service;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatReaction;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.model.ChatThread;
import com.planora.backend.model.User;
import com.planora.backend.repository.ChatMessageRepository;
import com.planora.backend.repository.ChatReactionRepository;
import com.planora.backend.repository.ChatReadStateRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.ChatThreadRepository;
import com.planora.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class ChatServiceTest {

    @Mock
    private ChatMessageRepository chatMessageRepository;
    @Mock
    private ChatReadStateRepository chatReadStateRepository;
    @Mock
    private ChatThreadRepository chatThreadRepository;
    @Mock
    private ChatRoomRepository chatRoomRepository;
    @Mock
    private ChatReactionRepository chatReactionRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ChatDocumentService chatDocumentService;

    @InjectMocks
    private ChatService chatService;

    private ChatMessage rootMessage;

    @BeforeEach
    void init() {
        rootMessage = new ChatMessage();
        rootMessage.setId(1L);
        rootMessage.setProjectId(10L);
        rootMessage.setRoomId(99L);
        rootMessage.setChatType(ChatMessage.ChatType.GROUP);
        rootMessage.setRecipient(null);
        rootMessage.setSender("owner");
    }

    @Test
    void saveThreadReply_inheritsRootMetadata_andCreatesThreadWhenMissing() {
        ChatRoom room = new ChatRoom();
        room.setId(99L);
        room.setArchived(false);

        ChatMessage reply = new ChatMessage();
        reply.setContent("hello thread");
        reply.setSender("alice");

        when(chatMessageRepository.findByIdAndProjectId(1L, 10L)).thenReturn(Optional.of(rootMessage));
        when(chatRoomRepository.findById(99L)).thenReturn(Optional.of(room));
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> {
            ChatMessage saved = invocation.getArgument(0);
            saved.setId(200L);
            return saved;
        });
        when(chatThreadRepository.findByProjectIdAndRootMessageId(10L, 1L)).thenReturn(Optional.empty());
        when(chatThreadRepository.save(any(ChatThread.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChatMessage saved = chatService.saveThreadReply(10L, 1L, reply);

        assertEquals(200L, saved.getId());
        assertEquals(1L, saved.getParentMessageId());
        assertEquals(10L, saved.getProjectId());
        assertEquals(99L, saved.getRoomId());
        assertEquals(ChatMessage.ChatType.GROUP, saved.getChatType());
        verify(chatThreadRepository).save(any(ChatThread.class));
    }

    @Test
    void saveThreadReply_rejectsArchivedRoom() {
        ChatRoom room = new ChatRoom();
        room.setId(99L);
        room.setArchived(true);

        when(chatMessageRepository.findByIdAndProjectId(1L, 10L)).thenReturn(Optional.of(rootMessage));
        when(chatRoomRepository.findById(99L)).thenReturn(Optional.of(room));

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                chatService.saveThreadReply(10L, 1L, new ChatMessage()));

        assertEquals("Channel is archived and read-only", ex.getMessage());
        verify(chatMessageRepository, never()).save(any());
    }

    @Test
    void editMessage_rejectsBlankContent() {
        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                chatService.editMessage(10L, 5L, "alice", "  ", ChatMessage.FormatType.PLAIN));

        assertEquals("Message content is required", ex.getMessage());
    }

    @Test
    void editMessage_updatesContentAndFormat() {
        ChatMessage existing = new ChatMessage();
        existing.setId(5L);
        existing.setProjectId(10L);
        existing.setSender("alice");
        existing.setContent("old");

        when(chatMessageRepository.findByIdAndProjectId(5L, 10L)).thenReturn(Optional.of(existing));
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChatMessage updated = chatService.editMessage(10L, 5L, "alice", " new content ", ChatMessage.FormatType.MARKDOWN);

        assertEquals("new content", updated.getContent());
        assertEquals(ChatMessage.FormatType.MARKDOWN, updated.getFormatType());
        assertNotNull(updated.getEditedAt());
    }

    @Test
    void softDeleteMessage_removesDocumentAndMarksDeleted() {
        ChatMessage existing = new ChatMessage();
        existing.setId(7L);
        existing.setProjectId(10L);
        existing.setSender("alice");
        existing.setContent("http://files/doc.png");

        when(chatMessageRepository.findByIdAndProjectId(7L, 10L)).thenReturn(Optional.of(existing));
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChatMessage deleted = chatService.softDeleteMessage(10L, 7L, "alice");

        verify(chatDocumentService).deleteChatDocument("http://files/doc.png");
        assertTrue(deleted.getDeleted());
        assertEquals("[message deleted]", deleted.getContent());
        assertNotNull(deleted.getDeletedAt());
    }

    @Test
    void toggleReaction_addsReactionWhenMissing() {
        ChatMessage message = new ChatMessage();
        message.setId(11L);
        message.setProjectId(10L);
        when(chatMessageRepository.findByIdAndProjectId(11L, 10L)).thenReturn(Optional.of(message));

        User actor = new User();
        actor.setUserId(33L);
        actor.setUsername("alice");
        actor.setEmail("alice@example.com");
        when(userRepository.findByUsernameIgnoreCase("alice")).thenReturn(Optional.of(actor));
        when(chatReactionRepository.findByMessageIdAndUserUserIdAndEmoji(11L, 33L, "👍")).thenReturn(Optional.empty());
        when(chatReactionRepository.findWithUserByMessageIdOrderByCreatedAtAsc(11L)).thenReturn(List.of());

        List<ChatService.ChatReactionSummary> summaries = chatService.toggleReaction(10L, 11L, "alice", "👍");

        verify(chatReactionRepository).save(any(ChatReaction.class));
        assertTrue(summaries.isEmpty());
    }

    @Test
    void toggleReaction_removesExistingReaction() {
        ChatMessage message = new ChatMessage();
        message.setId(12L);
        message.setProjectId(10L);
        when(chatMessageRepository.findByIdAndProjectId(12L, 10L)).thenReturn(Optional.of(message));

        User actor = new User();
        actor.setUserId(44L);
        actor.setUsername("bob");
        actor.setEmail("bob@example.com");
        when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(actor));

        ChatReaction reaction = new ChatReaction();
        reaction.setEmoji("🔥");
        when(chatReactionRepository.findByMessageIdAndUserUserIdAndEmoji(12L, 44L, "🔥")).thenReturn(Optional.of(reaction));
        when(chatReactionRepository.findWithUserByMessageIdOrderByCreatedAtAsc(12L)).thenReturn(List.of());

        chatService.toggleReaction(10L, 12L, "bob", "🔥");

        verify(chatReactionRepository).delete(reaction);
    }
}