package com.planora.backend.service;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatReaction;
import com.planora.backend.model.ChatReadState;
import com.planora.backend.model.ChatRoomMember;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.model.ChatThread;
import com.planora.backend.model.User;
import com.planora.backend.repository.ChatMessageRepository;
import com.planora.backend.repository.ChatReactionRepository;
import com.planora.backend.repository.ChatReadStateRepository;
import com.planora.backend.repository.ChatRoomMemberRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.ChatThreadRepository;
import com.planora.backend.repository.TeamMemberRepository;

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
    private ChatRoomMemberRepository chatRoomMemberRepository;
    @Mock
    private TeamMemberRepository teamMemberRepository;
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
    void saveMessage_appliesNonNullableDefaults() {
        ChatMessage message = new ChatMessage();
        message.setContent("hello");
        message.setDeleted(null);
        message.setFormatType(null);

        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var savedDto = chatService.saveMessage(message);

        assertFalse(savedDto.getDeleted());
        assertEquals(ChatMessage.FormatType.PLAIN, savedDto.getFormatType());
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

    @Test
    void getPrivateConversation_trimsNormalizesAndDeduplicatesAliases() {
        User alice = user(31L, " Alice ", "ALICE");
        User bob = user(32L, " Bob ", "BOB");
        when(userCacheService.resolveUserByEmailOrUsername("Alice")).thenReturn(alice);
        when(userCacheService.resolveUserByEmailOrUsername("BOB")).thenReturn(bob);
        when(chatMessageRepository.findConversationByAliases(10L, List.of("alice"), List.of("bob")))
                .thenReturn(List.of());

        var messages = chatService.getPrivateConversation(10L, "  Alice  ", " BOB ");

        assertTrue(messages.isEmpty());
        verify(chatMessageRepository).findConversationByAliases(10L, List.of("alice"), List.of("bob"));
    }

    @Test
    void markPrivateConversationAsRead_retriesWithCanonicalUsernamesAfterEmptyAliasLookup() {
        User alice = user(41L, "Alice", "alice@example.com");
        User bob = user(42L, "Bob", "bob@example.com");
        ChatMessage latest = new ChatMessage();
        latest.setId(700L);

        when(userCacheService.resolveUserByEmailOrUsername("Alice@Example.com")).thenReturn(alice);
        when(userCacheService.resolveUserByEmailOrUsername("Bob")).thenReturn(bob);
        when(chatMessageRepository.findLatestConversationMessagesByAliases(
                10L,
                List.of("alice", "alice@example.com"),
                List.of("bob", "bob@example.com")))
                .thenReturn(List.of());
        when(chatMessageRepository.findLatestConversationMessagesByAliases(
                10L,
                List.of("alice"),
                List.of("bob")))
                .thenReturn(List.of(latest));
        when(chatReadStateRepository.findFirstByProjectIdAndUserUserIdAndOtherParticipantIgnoreCase(
                10L, 41L, "bob"))
                .thenReturn(Optional.empty());

        chatService.markPrivateConversationAsRead(10L, " Alice@Example.com ", " Bob ");

        verify(chatMessageRepository).findLatestConversationMessagesByAliases(
                10L,
                List.of("alice", "alice@example.com"),
                List.of("bob", "bob@example.com"));
        verify(chatMessageRepository).findLatestConversationMessagesByAliases(
                10L,
                List.of("alice"),
                List.of("bob"));
        ArgumentCaptor<ChatReadState> readStateCaptor = ArgumentCaptor.forClass(ChatReadState.class);
        verify(chatReadStateRepository).save(readStateCaptor.capture());
        assertEquals(700L, readStateCaptor.getValue().getLastReadMessageId());
        assertEquals("bob", readStateCaptor.getValue().getOtherParticipant());
    }

    @Test
    void markPrivateConversationAsRead_doesNotRetryWhenAliasLookupSucceeds() {
        User alice = user(51L, "alice", "alice@example.com");
        User bob = user(52L, "bob", "bob@example.com");
        ChatMessage latest = new ChatMessage();
        latest.setId(701L);

        when(userCacheService.resolveUserByEmailOrUsername("alice")).thenReturn(alice);
        when(userCacheService.resolveUserByEmailOrUsername("bob")).thenReturn(bob);
        when(chatMessageRepository.findLatestConversationMessagesByAliases(
                10L,
                List.of("alice", "alice@example.com"),
                List.of("bob", "bob@example.com")))
                .thenReturn(List.of(latest));
        when(chatReadStateRepository.findFirstByProjectIdAndUserUserIdAndOtherParticipantIgnoreCase(
                10L, 51L, "bob"))
                .thenReturn(Optional.empty());

        chatService.markPrivateConversationAsRead(10L, "alice", "bob");

        verify(chatMessageRepository, never()).findLatestConversationMessagesByAliases(
                eq(10L),
                eq(List.of("alice")),
                eq(List.of("bob")));
        verify(chatReadStateRepository).save(any(ChatReadState.class));
    }

    @Test
    void getChatRoomsForProject_matchesCreatorByEmailOrUsername() {
        User alice = user(101L, "alice", "alice@example.com");
        ChatRoom room = new ChatRoom();
        room.setId(55L);
        room.setName("frontend");
        room.setCreatedBy("alice");
        room.setArchived(false);

        when(chatRoomMemberRepository.findRoomIdsByUserId(101L)).thenReturn(List.of());
        when(chatRoomRepository.findByProjectId(10L)).thenReturn(List.of(room));

        // When queried with email instead of username, it should still match via isRoomCreator
        List<ChatRoom> rooms = chatService.getChatRoomsForProject(10L, "alice@example.com", false, alice);

        assertEquals(1, rooms.size());
        assertEquals(55L, rooms.get(0).getId());
    }

    @Test
    void createRoom_allowsZeroExtraMembers_andAddsCreatorAsOwner() {
        User alice = user(101L, "alice", "alice@example.com");
        when(userCacheService.resolveUserByEmailOrUsername("alice")).thenReturn(alice);
        when(teamMemberRepository.findByTeamId(99L)).thenReturn(List.of());
        when(chatRoomRepository.save(any(ChatRoom.class))).thenAnswer(inv -> {
            ChatRoom r = inv.getArgument(0);
            r.setId(77L);
            return r;
        });

        ChatService.CreatedRoomResult result = chatService.createRoom(10L, 99L, "alice", "general", List.of());

        assertNotNull(result.room());
        assertEquals(77L, result.room().getId());
        assertEquals("general", result.room().getName());
        verify(chatRoomMemberRepository).save(any(com.planora.backend.model.ChatRoomMember.class));
    }

    private User user(Long id, String username, String email) {
        User user = new User();
        user.setUserId(id);
        user.setUsername(username);
        user.setEmail(email);
        return user;
    }
}
