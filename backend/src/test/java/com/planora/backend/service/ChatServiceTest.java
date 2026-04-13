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

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
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
    private UserCacheService userCacheService;
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
    @SuppressWarnings("null")
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

        var savedDto = chatService.saveThreadReply(10L, 1L, reply);

        assertEquals(200L, savedDto.getId());
        assertEquals(1L, savedDto.getParentMessageId());
        assertEquals(10L, savedDto.getProjectId());
        assertEquals(99L, savedDto.getRoomId());
        assertEquals(ChatMessage.ChatType.GROUP, savedDto.getChatType());
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

        var updatedDto = chatService.editMessage(10L, 5L, "alice", " new content ", ChatMessage.FormatType.MARKDOWN);

        assertEquals("new content", updatedDto.getContent());
        assertEquals(ChatMessage.FormatType.MARKDOWN, updatedDto.getFormatType());
        assertNotNull(updatedDto.getEditedAt());
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

        var deletedDto = chatService.softDeleteMessage(10L, 7L, "alice");

        verify(chatDocumentService).deleteChatDocument("http://files/doc.png");
        assertTrue(deletedDto.getDeleted());
        assertEquals("[message deleted]", deletedDto.getContent());
        assertNotNull(deletedDto.getDeletedAt());
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
        when(userCacheService.resolveUserByEmailOrUsername("alice")).thenReturn(actor);
        when(chatReactionRepository.findByMessageIdAndUserUserIdAndEmoji(11L, 33L, "👍")).thenReturn(Optional.empty());
        when(chatMessageRepository.findWithReactionsByIdAndProjectId(11L, 10L)).thenReturn(Optional.of(message));

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
        when(userCacheService.resolveUserByEmailOrUsername("bob")).thenReturn(actor);

        ChatReaction reaction = new ChatReaction();
        reaction.setEmoji("🔥");
        when(chatReactionRepository.findByMessageIdAndUserUserIdAndEmoji(12L, 44L, "🔥")).thenReturn(Optional.of(reaction));
        when(chatMessageRepository.findWithReactionsByIdAndProjectId(12L, 10L)).thenReturn(Optional.of(message));

        chatService.toggleReaction(10L, 12L, "bob", "🔥");

        verify(chatReactionRepository).delete(reaction);
    }

    @Test
    void toggleReaction_rejectsWhenActorCannotBeResolved() {
        ChatMessage message = new ChatMessage();
        message.setId(13L);
        message.setProjectId(10L);
        when(chatMessageRepository.findByIdAndProjectId(13L, 10L)).thenReturn(Optional.of(message));
        when(userCacheService.resolveUserByEmailOrUsername("ghost")).thenReturn(null);

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                chatService.toggleReaction(10L, 13L, "ghost", "👍"));

        assertEquals("User not found", ex.getMessage());
        verify(chatReactionRepository, never()).save(any(ChatReaction.class));
    }
}