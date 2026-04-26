package com.planora.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.ProjectDTO;
import com.planora.backend.dto.ProjectResponseDTO;
import com.planora.backend.dto.UpdateProjectDTO;
import com.planora.backend.model.ProjectType;
import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.ProjectService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProjectController.class)
class ProjectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ProjectService projectService;

    @MockBean
    private JWTService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setUserId(7L);
        user.setUsername("owner");
        user.setEmail("owner@example.com");
        principal = new UserPrincipal(user);
    }

    @Test
    void createProject_setsOwnerFromPrincipalAndReturnsCreated() throws Exception {
        ProjectDTO request = ProjectDTO.builder()
                .name("Planora")
                .projectKey("PLN")
                .description("Project description")
                .type(ProjectType.AGILE)
                .teamOption("NEW")
                .teamName("Alpha Team")
                .build();

        ProjectResponseDTO response = ProjectResponseDTO.builder()
                .id(100L)
                .name("Planora")
                .projectKey("PLN")
                .ownerId(7L)
                .teamName("Alpha Team")
                .type(ProjectType.AGILE)
                .build();

        when(projectService.createProject(any(ProjectDTO.class))).thenReturn(response);

        mockMvc.perform(post("/api/projects")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(100L))
                .andExpect(jsonPath("$.ownerId").value(7L));

        verify(projectService).createProject(any(ProjectDTO.class));
    }

    @Test
    void checkProjectKey_returnsTrueWhenAvailable() throws Exception {
        when(projectService.checkKeyExists("PLN")).thenReturn(false);

        mockMvc.perform(get("/api/projects/check-key")
                        .param("key", "PLN")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value(true));
    }

    @Test
    void getProjectsForUser_returnsProjectList() throws Exception {
        ProjectResponseDTO dto = ProjectResponseDTO.builder()
                .id(11L)
                .name("Project One")
                .projectKey("P1")
                .build();

        when(projectService.getProjectsForUser(7L, "AGILE", "name", "asc")).thenReturn(List.of(dto));

        mockMvc.perform(get("/api/projects")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal))
                        .param("type", "AGILE")
                        .param("sort", "name")
                        .param("order", "asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(11L))
                .andExpect(jsonPath("$[0].name").value("Project One"));
    }

    @Test
    void getProjectById_returnsSingleProject() throws Exception {
        ProjectResponseDTO dto = ProjectResponseDTO.builder()
                .id(12L)
                .name("Project Two")
                .projectKey("P2")
                .build();

        when(projectService.getProjectByIdForUser(12L, 7L)).thenReturn(dto);

        mockMvc.perform(get("/api/projects/12")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(12L))
                .andExpect(jsonPath("$.projectKey").value("P2"));
    }

    @Test
    void updateProject_returnsUpdatedDto() throws Exception {
        UpdateProjectDTO request = new UpdateProjectDTO();
        request.setName("Renamed Project");
        request.setDescription("Updated description");
        request.setType("KANBAN");

        ProjectResponseDTO response = ProjectResponseDTO.builder()
                .id(12L)
                .name("Renamed Project")
                .type(ProjectType.KANBAN)
                .build();

        when(projectService.updateProject(eq(12L), any(UpdateProjectDTO.class))).thenReturn(response);

        mockMvc.perform(put("/api/projects/12")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed Project"))
                .andExpect(jsonPath("$.type").value("KANBAN"));
    }

    @Test
    void recordAccess_invokesServiceAndReturnsOk() throws Exception {
        mockMvc.perform(post("/api/projects/99/access")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal))
                        .with(csrf()))
                .andExpect(status().isOk());

        verify(projectService).recordProjectAccess(99L, 7L);
    }

    @Test
    void toggleFavorite_invokesServiceAndReturnsOk() throws Exception {
        mockMvc.perform(post("/api/projects/99/favorite")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal))
                        .with(csrf()))
                .andExpect(status().isOk());

        verify(projectService).toggleFavorite(99L, 7L);
    }

    @Test
    void deleteProject_returnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/projects/88/team/55")
                        .with(SecurityMockMvcRequestPostProcessors.user(principal))
                        .with(csrf()))
                .andExpect(status().isNoContent());

        verify(projectService).deleteProject(88L, 55L, 7L);
    }
}