package com.planora.backend.controller;

import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.model.ChatRoomMember;
import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.User;
import com.planora.backend.repository.ChatRoomMemberRepository;
import com.planora.backend.repository.ChatRoomRepository;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
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
        when(teamMemberRepository.findByTeamId(99L)).thenReturn(List.of(aliceMember, bobMember));

        when(userRepository.findByUsernameIgnoreCase("alice")).thenReturn(Optional.of(alice));
        when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(bob));

        when(chatRoomMemberRepository.findByUserUserId(anyLong())).thenReturn(List.of());
        when(chatRoomRepository.findByProjectId(10L)).thenReturn(List.of());
        when(chatService.buildUnreadBadge(eq(10L), any(), any(), any())).thenReturn(
                new ChatService.UnreadBadgeSummary(0, 0, 0, 0));

        doAnswer(invocation -> {
            Runnable runnable = invocation.getArgument(0);
            runnable.run();
            return null;
        }).when(chatTaskExecutor).execute(any(Runnable.class));
    }

    @Test
    void sendMessage_teamChatCreatesNotificationForOtherMembersOnly() {
        ChatMessage incoming = new ChatMessage();
        incoming.setContent("Team update");

        ChatMessage saved = new ChatMessage();
        saved.setId(100L);
        saved.setContent("Team update");
        saved.setSender("alice");
        saved.setProjectId(10L);

        when(chatService.saveMessage(any(ChatMessage.class))).thenReturn(saved);

        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create();
        headers.setUser((Principal) () -> "alice");

        chatController.sendMessage(10L, incoming, headers);

        verify(notificationService, times(1)).createNotification(eq(bob), any(), eq("/project/10/chat"));
        verify(notificationService, never()).createNotification(eq(alice), any(), any());
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
        when(userRepository.findAllById(any())).thenReturn(List.of(bob, carol));

        ChatMessage incoming = new ChatMessage();
        incoming.setContent("Group update");

        ChatMessage saved = new ChatMessage();
        saved.setId(200L);
        saved.setContent("Group update");
        saved.setSender("alice");
        saved.setProjectId(10L);
        saved.setRoomId(7L);

        when(chatService.saveMessage(any(ChatMessage.class))).thenReturn(saved);

        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.create();
        headers.setUser((Principal) () -> "alice");

        chatController.sendRoomMessage(10L, 7L, incoming, headers);

        verify(notificationService, times(2)).createNotification(any(User.class), any(), eq("/project/10/chat"));
        verify(notificationService).createNotification(eq(bob), any(), eq("/project/10/chat"));
        verify(notificationService).createNotification(eq(carol), any(), eq("/project/10/chat"));
        verify(notificationService, never()).createNotification(eq(alice), any(), any());
    }
}
