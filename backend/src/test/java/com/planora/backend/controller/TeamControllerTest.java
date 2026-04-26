package com.planora.backend.controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.TeamCreationDTO;
import com.planora.backend.dto.TeamDetailDTO;
import com.planora.backend.dto.TeamSummaryDTO;
import com.planora.backend.model.Team;
import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.TeamService;
import com.planora.backend.service.JWTService;

@WebMvcTest(TeamController.class)
public class TeamControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TeamService teamService;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        User testUser = new User();
        testUser.setUserId(1L);
        testUser.setFullName("Test User");
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");

        principal = new UserPrincipal(testUser);
    }

    @Test
    void checkTeamName_success() throws Exception {
        when(teamService.checkTeamNameAvailability(anyString(), anyLong()))
                .thenReturn(java.util.Map.of("exists", false));

        mockMvc.perform(get("/api/teams/check-name")
                .param("name", "New Team")
                .with(user(principal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.exists").value(false));
    }

    @Test
    void createTeam_success() throws Exception {
        TeamCreationDTO dto = new TeamCreationDTO();
        dto.setName("New Team");

        User owner = new User();
        owner.setUserId(1L);
        owner.setFullName("Test User");

        Team createdTeam = new Team();
        createdTeam.setId(10L);
        createdTeam.setName("Test Team");
        createdTeam.setOwner(owner);

        when(teamService.createTeam(any(), anyLong())).thenReturn(createdTeam);

        mockMvc.perform(post("/api/teams")
                .with(user(principal))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Test Team"));
    }

    @Test
    void getAllTeams_success() throws Exception {
        TeamSummaryDTO summary = new TeamSummaryDTO(10L, "Test Team", "Owner Name");
        when(teamService.getMyTeams(anyLong())).thenReturn(List.of(summary));

        mockMvc.perform(get("/api/teams")
                .with(user(principal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Test Team"));
    }

    @Test
    void getTeam_success() throws Exception {
        TeamDetailDTO detail = new TeamDetailDTO();
        detail.setId(10L);
        detail.setName("Test Team");

        when(teamService.getTeamDetails(anyLong(), anyLong())).thenReturn(detail);

        mockMvc.perform(get("/api/teams/10")
                .with(user(principal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Test Team"));
    }

    @Test
    void deleteTeam_success() throws Exception {
        mockMvc.perform(delete("/api/teams/10")
                .with(user(principal))
                .with(csrf()))
                .andExpect(status().isNoContent());
    }
}
