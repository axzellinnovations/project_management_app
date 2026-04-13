package com.planora.backend.controller;

import com.planora.backend.model.ChatMessage;
import com.planora.backend.dto.ChatMessageDTO;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.model.ChatRoomMember;
import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.User;
import com.planora.backend.repository.ChatRoomMemberRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.ChatMessageRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.ChatPresenceService;
import com.planora.backend.service.ChatService;
import com.planora.backend.service.ChatWebhookService;
import com.planora.backend.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.security.Principal;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Executor;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatControllerNotificationTest {

    @Mock
    private SimpMessagingTemplate simpMessagingTemplate;
    @Mock
    private Executor chatTaskExecutor;
    @Mock
    private ChatService chatService;
    @Mock
    private TeamMemberRepository teamMemberRepository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ChatRoomRepository chatRoomRepository;
    @Mock
    private ChatRoomMemberRepository chatRoomMemberRepository;
    @Mock
    private ChatMessageRepository chatMessageRepository;
    @Mock
    private ChatPresenceService chatPresenceService;
    @Mock
    private ChatWebhookService chatWebhookService;
    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private ChatController chatController;

    private Project project;
    private Team team;
    private User alice;
    private User bob;
    private User carol;

    @BeforeEach
    void setUp() {
        // Ensure convertToEntity returns a valid ChatMessage for any DTO
        lenient().when(chatService.convertToEntity(any(ChatMessageDTO.class))).thenAnswer(invocation -> {
            ChatMessageDTO dto = invocation.getArgument(0);
            ChatMessage entity = new ChatMessage();
            entity.setId(dto.getId());
            entity.setContent(dto.getContent());
            entity.setSender(dto.getSender());
            entity.setRecipient(dto.getRecipient());
            entity.setProjectId(dto.getProjectId());
            entity.setRoomId(dto.getRoomId());
            entity.setChatType(dto.getChatType());
            entity.setParentMessageId(dto.getParentMessageId());
            entity.setFormatType(dto.getFormatType());
            entity.setDeleted(dto.getDeleted());
            entity.setDeletedAt(dto.getDeletedAt());
            entity.setEditedAt(dto.getEditedAt());
            return entity;
        });
        team = new Team();
        team.setId(99L);

        project = new Project();
        project.setId(10L);
        project.setName("Planora");
        project.setTeam(team);

        alice = new User();
        alice.setUserId(1L);
        alice.setUsername("alice");
        alice.setEmail("alice@example.com");

        bob = new User();
        bob.setUserId(2L);
        bob.setUsername("bob");
        bob.setEmail("bob@example.com");

        carol = new User();
        carol.setUserId(3L);
        carol.setUsername("carol");
        carol.setEmail("carol@example.com");

        TeamMember aliceMember = new TeamMember();
        aliceMember.setUser(alice);
        aliceMember.setTeam(team);

        TeamMember bobMember = new TeamMember();
        bobMember.setUser(bob);
        bobMember.setTeam(team);

        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(99L, 1L)).thenReturn(Optional.of(aliceMember));
        lenient().when(teamMemberRepository.findByTeamIdAndUserUserId(99L, 2L)).thenReturn(Optional.of(bobMember));
        lenient().when(teamMemberRepository.findByTeamId(99L)).thenReturn(List.of(aliceMember, bobMember));

        when(userRepository.findByUsernameIgnoreCase("alice")).thenReturn(Optional.of(alice));
        lenient().when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(bob));

        lenient().when(chatRoomMemberRepository.findByUserUserId(anyLong())).thenReturn(List.of());
        lenient().when(chatRoomRepository.findByProjectId(10L)).thenReturn(List.of());
        lenient().when(chatService.buildUnreadBadge(eq(10L), any(), any(), any())).thenReturn(
                new ChatService.UnreadBadgeSummary(0, 0, 0, 0));

        doAnswer(invocation -> {
            Runnable runnable = invocation.getArgument(0);
            runnable.run();
            return null;
        }).when(chatTaskExecutor).execute(any(Runnable.class));
    }

    @Test
    void sendMessage_teamChatCreatesNotificationForOtherMembersOnly() {
		ChatMessageDTO incomingDto = new ChatMessageDTO();
		incomingDto.setContent("Team update");

		ChatMessageDTO saved = new ChatMessageDTO();
		saved.setId(100L);
		saved.setContent("Team update");
		saved.setSender("alice");
		saved.setProjectId(10L);

		when(chatService.saveMessage(any(ChatMessage.class))).thenReturn(saved);

		SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create();
		headers.setUser((Principal) () -> "alice");

		chatController.sendMessage(10L, incomingDto, headers);

        verify(notificationService, times(1)).createNotification(eq(bob), any(), eq("/project/10/chat"));
        verify(notificationService, never()).createNotification(eq(alice), any(), any());
    }

    @Test
    void sendPrivateMessage_createsNotificationForRecipientWithScopedChatLink() {
		ChatMessageDTO incomingDto = new ChatMessageDTO();
		incomingDto.setContent("Hello Bob");
		incomingDto.setRecipient("bob");

		ChatMessageDTO saved = new ChatMessageDTO();
		saved.setId(300L);
		saved.setContent("Hello Bob");
		saved.setSender("alice");
		saved.setRecipient("bob");
		saved.setProjectId(10L);

		when(chatService.saveMessage(any(ChatMessage.class))).thenReturn(saved);

		SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create();
		headers.setUser((Principal) () -> "alice");

		chatController.sendPrivateMessage(10L, incomingDto, headers);

        verify(notificationService).createNotification(
                eq(bob),
                contains("sent you a message"),
                eq("/project/10/chat?with=alice"));
        verify(notificationService, never()).createNotificationIfNotDuplicate(any(), any(), any());
    }

    @Test
    void toggleReaction_notifiesOriginalMessageSenderExceptActor() {
        ChatMessage targetMessage = new ChatMessage();
        targetMessage.setId(501L);
        targetMessage.setProjectId(10L);
        targetMessage.setSender("bob");
        targetMessage.setContent("Need review");

        when(chatService.toggleReaction(10L, 501L, "alice", "👍"))
                .thenReturn(List.of(new ChatService.ChatReactionSummary("👍", 1L, true)));
        when(chatMessageRepository.findByIdAndProjectId(501L, 10L)).thenReturn(Optional.of(targetMessage));

        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create();
        headers.setUser((Principal) () -> "alice");

        chatController.toggleReaction(10L, 501L, new ChatController.ReactionTogglePayload("👍"), headers);

        verify(notificationService).createNotification(
                eq(bob),
                contains("reacted"),
                eq("/project/10/chat?view=team"));
    }

    @Test
    void sendRoomMessage_groupChatCreatesNotificationForRoomMembersAndCreatorExcludingSender() {
        ChatRoom room = new ChatRoom();
        room.setId(7L);
        room.setProjectId(10L);
        room.setName("engineering");
        room.setCreatedBy("carol");
        room.setArchived(false);

        ChatRoomMember senderMembership = new ChatRoomMember();
        senderMembership.setChatRoom(room);
        senderMembership.setUser(alice);

        ChatRoomMember bobMembership = new ChatRoomMember();
        bobMembership.setChatRoom(room);
        bobMembership.setUser(bob);

        when(chatRoomRepository.findById(7L)).thenReturn(Optional.of(room));
        when(userRepository.findByUsernameIgnoreCase("carol")).thenReturn(Optional.of(carol));
        when(chatRoomMemberRepository.findByChatRoomIdAndUserUserId(7L, 1L)).thenReturn(Optional.of(senderMembership));
        when(chatRoomMemberRepository.findByChatRoomId(7L)).thenReturn(List.of(senderMembership, bobMembership));
        @SuppressWarnings("null")
        List<User> users = List.of(bob, carol);
        when(userRepository.findAllById((Iterable<Long>) any())).thenReturn(users);

		ChatMessageDTO incomingDto = new ChatMessageDTO();
		incomingDto.setContent("Group update");

		ChatMessageDTO saved = new ChatMessageDTO();
		saved.setId(200L);
		saved.setContent("Group update");
		saved.setSender("alice");
		saved.setProjectId(10L);
		saved.setRoomId(7L);

		when(chatService.saveMessage(any(ChatMessage.class))).thenReturn(saved);

		SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create();
		headers.setUser((Principal) () -> "alice");

		chatController.sendRoomMessage(10L, 7L, incomingDto, headers);

        verify(notificationService, times(2)).createNotification(any(User.class), any(), eq("/project/10/chat"));
        verify(notificationService).createNotification(eq(bob), any(), eq("/project/10/chat"));
        verify(notificationService).createNotification(eq(carol), any(), eq("/project/10/chat"));
        verify(notificationService, never()).createNotification(eq(alice), any(), any());
    }
}
