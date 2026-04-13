package com.planora.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.planora.backend.dto.ProjectResponseDTO;
import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatReadState;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.model.ChatRoomMember;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.User;
import com.planora.backend.repository.ChatMessageRepository;
import com.planora.backend.repository.ChatReadStateRepository;
import com.planora.backend.repository.ChatRoomMemberRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.TeamMemberRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChatInboxServiceTest {

    @Mock private ChatService chatService;
    @Mock private ProjectService projectService;
    @Mock private TeamMemberRepository teamMemberRepository;
    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatRoomMemberRepository chatRoomMemberRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private ChatReadStateRepository chatReadStateRepository;
    @Mock private UserCacheService userCacheService;

    @InjectMocks
    private ChatInboxService chatInboxService;

    @Test
    void getInbox_usesBatchTeamAndRoomQueries() {
        User currentUser = new User();
        currentUser.setUserId(7L);
        currentUser.setUsername("dev");
        currentUser.setEmail("dev@planora.com");

        ProjectResponseDTO p1 = ProjectResponseDTO.builder().id(1L).name("Alpha").teamId(101L).build();
        ProjectResponseDTO p2 = ProjectResponseDTO.builder().id(2L).name("Beta").teamId(102L).build();

        TeamMember tm1 = new TeamMember();
        tm1.setTeam(new Team());
        tm1.getTeam().setId(101L);
        tm1.setUser(currentUser);

        TeamMember tm2 = new TeamMember();
        tm2.setTeam(new Team());
        tm2.getTeam().setId(102L);
        User betaUser = new User();
        betaUser.setUsername("qa");
        tm2.setUser(betaUser);

        ChatRoom room1 = new ChatRoom();
        room1.setId(11L);
        room1.setProjectId(1L);
        room1.setCreatedBy("dev");

        ChatRoom room2 = new ChatRoom();
        room2.setId(22L);
        room2.setProjectId(2L);
        room2.setCreatedBy("qa");

        ChatRoomMember rm = new ChatRoomMember();
        rm.setChatRoom(room1);

        ChatMessage teamMessage = new ChatMessage();
        teamMessage.setProjectId(1L);
        teamMessage.setContent("hello");

        ChatReadState readState = new ChatReadState();
        readState.setProjectId(1L);
        readState.setLastReadMessageId(10L);

        when(userCacheService.resolveUserByEmailOrUsername("dev")).thenReturn(currentUser);
        when(projectService.getProjectsForUser(7L, null, null, null)).thenReturn(List.of(p1, p2));
        when(chatRoomMemberRepository.findByUserUserId(7L)).thenReturn(List.of(rm));
        when(teamMemberRepository.findByTeamIdIn(anySet())).thenReturn(List.of(tm1, tm2));
        when(chatRoomRepository.findByProjectIdIn(List.of(1L, 2L))).thenReturn(List.of(room1, room2));
        when(chatMessageRepository.findLatestTeamMessagesForProjects(List.of(1L, 2L))).thenReturn(List.of(teamMessage));
        when(chatReadStateRepository.findByUserUserIdAndProjectIdInAndOtherParticipantIgnoreCase(7L, List.of(1L, 2L), "__TEAM_CHAT__"))
                .thenReturn(List.of(readState));
        when(chatService.buildTeamSummary(nullable(ChatMessage.class), eq(0L)))
                .thenReturn(new ChatService.TeamChatSummary("hello", "dev", "2026-04-01T10:00:00", 0));
        when(chatService.buildRoomSummaries(any(), eq(currentUser), eq("dev"), any()))
                .thenReturn(List.of());
        when(chatService.buildDirectSummaries(any(), eq(currentUser), eq("dev"), any()))
                .thenReturn(List.of());

        ChatInboxService.ChatInboxResponse response = chatInboxService.getInbox(7L, "dev", 10, 10, "all");

        assertEquals(2, response.totalActivities());
        verify(teamMemberRepository, times(1)).findByTeamIdIn(anySet());
        verify(teamMemberRepository, never()).findByTeamId(any());
        verify(chatRoomRepository, times(1)).findByProjectIdIn(List.of(1L, 2L));
        verify(chatRoomRepository, never()).findByProjectId(any());
    }
}
