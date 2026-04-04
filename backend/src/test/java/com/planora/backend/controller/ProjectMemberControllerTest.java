package com.planora.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamInvitation;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamInvitationRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.TeamMemberService;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ProjectMemberController.class)
class ProjectMemberControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ProjectRepository projectRepository;
    @MockBean
    private TeamMemberRepository teamMemberRepository;
    @MockBean
    private TeamInvitationRepository teamInvitationRepository;
    @MockBean
    private TaskRepository taskRepository;
    @MockBean
    private TeamMemberService teamMemberService;
    @MockBean
    private NotificationService notificationService;
    @MockBean
    private UserRepository userRepository;
    @MockBean
    private SimpMessagingTemplate simpMessagingTemplate;
    @MockBean
    private JWTService jwtService;
    @MockBean
    private UserDetailsService userDetailsService;

    private Team team;
    private Project project;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        team = new Team();
        team.setId(50L);

        project = new Project();
        project.setId(8L);
        project.setName("Apollo");
        project.setTeam(team);

        User user = new User();
        user.setUserId(5L);
        user.setUsername("owner");
        user.setFullName("Owner Name");
        user.setEmail("owner@example.com");
        principal = new UserPrincipal(user);

        when(projectRepository.findById(8L)).thenReturn(Optional.of(project));
    }

    @Test
    void getProjectMembers_returnsMemberDtos() throws Exception {
        User memberUser = new User();
        memberUser.setUserId(20L);
        memberUser.setUsername("teammate");
        memberUser.setFullName("Team Mate");
        memberUser.setEmail("mate@example.com");

        TeamMember member = new TeamMember();
        member.setId(200L);
        member.setRole(TeamRole.MEMBER);
        member.setUser(memberUser);
        memberUser.setLastActive(LocalDateTime.parse("2026-03-01T10:00:00"));

        when(teamMemberService.getTeamMembers(50L)).thenReturn(List.of(member));
        when(taskRepository.countByAssigneeAndProject_TeamId(member, 50L)).thenReturn(3L);

        mockMvc.perform(get("/api/projects/8/members")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(200L))
                .andExpect(jsonPath("$[0].role").value("MEMBER"))
                .andExpect(jsonPath("$[0].user.username").value("teammate"))
                .andExpect(jsonPath("$[0].taskCount").value(3));

        verify(teamMemberService).validateMembership(50L, 5L);
    }

    @Test
    void getPendingInvites_returnsPendingList() throws Exception {
        TeamInvitation invite = new TeamInvitation();
        invite.setId(10L);
        invite.setEmail("pending@example.com");
        invite.setInvitedAt(LocalDateTime.parse("2026-03-10T12:00:00"));
        invite.setRole("MEMBER");

        when(teamInvitationRepository.findByTeamIdAndStatus(50L, "PENDING")).thenReturn(List.of(invite));

        mockMvc.perform(get("/api/projects/8/pending-invites")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value("pending@example.com"))
                .andExpect(jsonPath("$[0].status").value("Pending"));

        verify(teamMemberService).validateMembership(50L, 5L);
    }

    @Test
    void changeMemberRole_invokesService() throws Exception {
        var request = new ProjectMemberController.ChangeRoleRequest();
        request.role = "ADMIN";
        request.userId = 20L;

        when(teamMemberService.changeMemberRoleWithPermissions(50L, 20L, "ADMIN", 5L))
                .thenReturn(new TeamMember());

        mockMvc.perform(patch("/api/projects/8/members/20/role")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        verify(teamMemberService).changeMemberRoleWithPermissions(50L, 20L, "ADMIN", 5L);
    }

    @Test
    void changeMemberRole_notifiesAffectedUserAndBroadcastsEvent() throws Exception {
    var request = new ProjectMemberController.ChangeRoleRequest();
    request.role = "ADMIN";
    request.userId = 20L;

    User changedUser = new User();
    changedUser.setUserId(20L);
    changedUser.setUsername("teammate");

    User actorUser = new User();
    actorUser.setUserId(5L);
    actorUser.setUsername("owner");
    actorUser.setFullName("Owner Name");

    when(teamMemberService.changeMemberRoleWithPermissions(50L, 20L, "ADMIN", 5L))
        .thenReturn(new TeamMember());
    when(userRepository.findById(20L)).thenReturn(Optional.of(changedUser));
    when(userRepository.findById(5L)).thenReturn(Optional.of(actorUser));

    mockMvc.perform(patch("/api/projects/8/members/20/role")
            .with(SecurityMockMvcRequestPostProcessors.user(principal))
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk());

    verify(teamMemberService).changeMemberRoleWithPermissions(50L, 20L, "ADMIN", 5L);
    verify(notificationService).createNotification(
        eq(changedUser),
        contains("Owner Name updated your role to Admin in project \"Apollo\""),
        eq("/members/8")
    );
    verify(simpMessagingTemplate).convertAndSend(
        eq("/topic/project/8/members"),
        org.mockito.ArgumentMatchers.<Object>argThat(payload -> {
            if (!(payload instanceof ProjectMemberController.MemberEvent event)) {
            return false;
            }
            return event.action() == ProjectMemberController.MemberEventAction.ROLE_CHANGED
                && Long.valueOf(20L).equals(event.userId())
                && "ADMIN".equals(event.newRole());
        })
    );
    }

    @Test
    void removeMember_invokesService() throws Exception {
        mockMvc.perform(delete("/api/projects/8/members/20")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal))
                        .with(csrf()))
                .andExpect(status().isOk());

        verify(teamMemberService).removeMemberWithPermissions(50L, 20L, 5L);
    }

    @Test
    void removeMember_notifiesRemovedUserAndBroadcastsEvent() throws Exception {
        User removedUser = new User();
        removedUser.setUserId(20L);
        removedUser.setUsername("teammate");

        User actorUser = new User();
        actorUser.setUserId(5L);
        actorUser.setUsername("owner");
        actorUser.setFullName("Owner Name");

        when(userRepository.findById(20L)).thenReturn(Optional.of(removedUser));
        when(userRepository.findById(5L)).thenReturn(Optional.of(actorUser));

        mockMvc.perform(delete("/api/projects/8/members/20")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal))
                        .with(csrf()))
                .andExpect(status().isOk());

        verify(teamMemberService).removeMemberWithPermissions(50L, 20L, 5L);
        verify(notificationService).createNotification(
                eq(removedUser),
                contains("Owner Name removed you from project \"Apollo\""),
                eq("/dashboard")
        );
        verify(simpMessagingTemplate).convertAndSend(
                eq("/topic/project/8/members"),
                org.mockito.ArgumentMatchers.<Object>argThat(payload -> {
                    if (!(payload instanceof ProjectMemberController.MemberEvent event)) {
                        return false;
                    }
                    return event.action() == ProjectMemberController.MemberEventAction.MEMBER_REMOVED
                            && Long.valueOf(20L).equals(event.userId());
                })
        );
    }
}