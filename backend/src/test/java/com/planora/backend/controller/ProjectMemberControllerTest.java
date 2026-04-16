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
import com.planora.backend.service.TeamMemberService;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.nullable;
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
    private UserService userService;
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
        when(userService.generatePresignedUrl(nullable(String.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
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
        when(taskRepository.countTasksByAssigneeUserIdsAndTeamId(List.of(20L), 50L))
                .thenReturn(java.util.Collections.singletonList(new Object[] {20L, 3L}));

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

        when(teamMemberService.changeMemberRoleWithPermissions(50L, 20L, "ADMIN", 5L, 8L, "Apollo"))
                .thenReturn(new TeamMember());

        mockMvc.perform(patch("/api/projects/8/members/20/role")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        verify(teamMemberService).changeMemberRoleWithPermissions(50L, 20L, "ADMIN", 5L, 8L, "Apollo");
    }

    @Test
    void removeMember_invokesService() throws Exception {
        mockMvc.perform(delete("/api/projects/8/members/20")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal))
                        .with(csrf()))
                .andExpect(status().isOk());

        verify(teamMemberService).removeMemberWithPermissions(50L, 20L, 5L, 8L, "Apollo");
    }

}