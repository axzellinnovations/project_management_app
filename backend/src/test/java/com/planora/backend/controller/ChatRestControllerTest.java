package com.planora.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.model.ChatRoomMember;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.User;
import com.planora.backend.repository.ChatRoomMemberRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.ChatDocumentService;
import com.planora.backend.service.ChatPresenceService;
import com.planora.backend.service.ChatService;
import com.planora.backend.service.ChatWebhookService;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.NotificationService;
import com.planora.backend.dto.ChatMessageDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.mockito.Mock;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ChatRestController.class)
class ChatRestControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Mock
    private ChatService chatService;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private TeamMemberRepository teamMemberRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ChatRoomRepository chatRoomRepository;
    @Mock
    private ChatRoomMemberRepository chatRoomMemberRepository;
    @Mock
    private SimpMessagingTemplate simpMessagingTemplate;
    @Mock
    private ChatPresenceService chatPresenceService;
    @Mock
    private ChatWebhookService chatWebhookService;
    @Mock
    private ChatDocumentService chatDocumentService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private JWTService jwtService;
    @Mock
    private UserDetailsService userDetailsService;

    private User alice;
    private Team team;

    @BeforeEach
    void setUp() {
        team = new Team();
        team.setId(7L);

        var project = new com.planora.backend.model.Project();
        project.setId(5L);
        project.setTeam(team);

        alice = new User();
        alice.setUserId(10L);
        alice.setUsername("alice");
        alice.setEmail("alice@example.com");

        TeamMember member = new TeamMember();
        member.setUser(alice);
        member.setTeam(team);

        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        when(userRepository.findByUsernameIgnoreCase("alice")).thenReturn(Optional.of(alice));
        when(userRepository.findByEmailIgnoreCase("alice")).thenReturn(Optional.of(alice));
        when(teamMemberRepository.findByTeamIdAndUserUserId(7L, 10L)).thenReturn(Optional.of(member));
        when(teamMemberRepository.findByTeamId(7L)).thenReturn(List.of(member));
    }

    @Test
    @WithMockUser(username = "alice")
    void getRoomMessages_marksAsRead_andReturnsPayload() throws Exception {
		ChatMessageDTO message = new ChatMessageDTO();
		message.setId(21L);
		message.setContent("Hello room");

        ChatRoom room = new ChatRoom();
        room.setId(9L);
        room.setProjectId(5L);

        ChatRoomMember roomMember = new ChatRoomMember();
        roomMember.setUser(alice);
        roomMember.setChatRoom(room);

        when(chatRoomRepository.findById(9L)).thenReturn(Optional.of(room));
        when(chatRoomMemberRepository.findByChatRoomIdAndUserUserId(9L, 10L)).thenReturn(Optional.of(roomMember));
        when(chatService.getRoomMessages(5L, 9L)).thenReturn(List.of(message));

        mockMvc.perform(get("/api/projects/5/chat/messages")
                        .param("roomId", "9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(21L))
                .andExpect(jsonPath("$[0].content").value("Hello room"));

        verify(chatService).markRoomAsRead(5L, 9L, "alice");
    }

    @Test
    @WithMockUser(username = "alice")
    void getPrivateMessages_marksConversationRead() throws Exception {
        User bob = new User();
        bob.setUserId(11L);
        bob.setUsername("bob");
        bob.setEmail("bob@example.com");

        when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(bob));
        when(userRepository.findByEmailIgnoreCase("bob")).thenReturn(Optional.of(bob));
        when(teamMemberRepository.findByTeamIdAndUserUserId(7L, 11L)).thenReturn(Optional.of(new TeamMember()));

		ChatMessageDTO dm = new ChatMessageDTO();
		dm.setId(30L);
		dm.setSender("alice");
		dm.setRecipient("bob");

        when(chatService.getPrivateConversation(5L, "alice", "bob")).thenReturn(List.of(dm));

        mockMvc.perform(get("/api/projects/5/chat/messages")
                        .param("recipient", "alice")
                        .param("with", "bob"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].recipient").value("bob"));

        verify(chatService).markPrivateConversationAsRead(5L, "alice", "bob");
    }

    @Test
    @WithMockUser(username = "alice")
    void createThreadReply_rejectsBlankContent() throws Exception {
            @SuppressWarnings("null")
        var request = new ChatRestController.ThreadReplyRequest("   ", ChatMessage.FormatType.PLAIN);

        mockMvc.perform(post("/api/projects/5/chat/messages/1/thread/replies")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "alice")
    void createThreadReply_returnsCreatedMessage() throws Exception {
            @SuppressWarnings("null")
        var request = new ChatRestController.ThreadReplyRequest("reply", ChatMessage.FormatType.PLAIN);
		ChatMessageDTO saved = new ChatMessageDTO();
		saved.setId(77L);
		saved.setContent("reply");

		when(chatService.saveThreadReply(eq(5L), eq(1L), any(ChatMessage.class))).thenReturn(saved);

        mockMvc.perform(post("/api/projects/5/chat/messages/1/thread/replies")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(77L))
                .andExpect(jsonPath("$.content").value("reply"));
    }

    @Test
    @WithMockUser(username = "alice")
    void toggleReaction_blankEmojiReturnsBadRequest() throws Exception {
            @SuppressWarnings("null")
        var request = new ChatRestController.ReactionToggleRequest(" ");

        mockMvc.perform(post("/api/projects/5/chat/messages/9/reactions/toggle")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "alice")
    void toggleReaction_returnsSummaries() throws Exception {
        var request = new ChatRestController.ReactionToggleRequest("👍");
        var summary = new ChatService.ChatReactionSummary("👍", 1L, true);
        when(chatService.toggleReaction(5L, 9L, "alice", "👍")).thenReturn(List.of(summary));

        mockMvc.perform(post("/api/projects/5/chat/messages/9/reactions/toggle")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].emoji").value("👍"))
                .andExpect(jsonPath("$[0].reactedByCurrentUser").value(true));
    }

    @Test
    @WithMockUser(username = "alice")
    void getFeatureFlags_returnsConfigValues() throws Exception {
        mockMvc.perform(get("/api/projects/5/chat/features"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phaseDEnabled").value(true))
                .andExpect(jsonPath("$.phaseEEnabled").value(true))
                .andExpect(jsonPath("$.webhooksEnabled").value(true))
                .andExpect(jsonPath("$.telemetryEnabled").value(true));
    }

    @Test
    @WithMockUser(username = "alice")
    void createRoom_notifiesOnlyAddedMembers() throws Exception {
        User bob = new User();
        bob.setUserId(11L);
        bob.setUsername("bob");
        bob.setEmail("bob@example.com");

        TeamMember bobMember = new TeamMember();
        bobMember.setUser(bob);
        bobMember.setTeam(team);

        TeamMember aliceMember = new TeamMember();
        aliceMember.setUser(alice);
        aliceMember.setTeam(team);

        when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(bob));
        when(userRepository.findByEmailIgnoreCase("bob")).thenReturn(Optional.of(bob));
        when(teamMemberRepository.findByTeamIdAndUserUserId(7L, 11L)).thenReturn(Optional.of(bobMember));
        when(teamMemberRepository.findByTeamId(7L)).thenReturn(List.of(bobMember, aliceMember));

        ChatRoom savedRoom = new ChatRoom();
        savedRoom.setId(91L);
        savedRoom.setName("incident");
        savedRoom.setProjectId(5L);
        savedRoom.setCreatedBy("alice");
        savedRoom.setArchived(false);

        when(chatRoomRepository.save(any(ChatRoom.class))).thenReturn(savedRoom);
        when(chatRoomMemberRepository.findByChatRoomIdAndUserUserId(eq(91L), anyLong())).thenReturn(Optional.empty());

        var request = new ChatRestController.ChatRoomRequest("incident", List.of("bob"));

        mockMvc.perform(post("/api/projects/5/chat/rooms")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(91L))
                .andExpect(jsonPath("$.name").value("incident"));

        verify(notificationService).createNotification(
                eq(bob),
                contains("added you to #incident"),
                eq("/project/5/chat?roomId=91"));
    }
}