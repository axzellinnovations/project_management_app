package com.planora.backend.controller;

import com.planora.backend.annotation.WithMockUserPrincipal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.MilestoneRequestDTO;
import com.planora.backend.dto.MilestoneResponseDTO;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.MilestoneService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(MilestoneController.class)
class MilestoneControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MilestoneService milestoneService;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    private MilestoneResponseDTO sampleMilestone;
    private MilestoneRequestDTO milestoneRequest;

    @BeforeEach
    void setUp() {
        sampleMilestone = new MilestoneResponseDTO();
        sampleMilestone.setId(1L);
        sampleMilestone.setName("v1.0 Release");
        sampleMilestone.setProjectId(10L);

        milestoneRequest = new MilestoneRequestDTO();
        milestoneRequest.setName("v1.0 Release");
    }

    @Test
    @WithMockUserPrincipal
    void createMilestone_returns200WithCreatedMilestone() throws Exception {
        when(milestoneService.createMilestone(eq(10L), any(), any())).thenReturn(sampleMilestone);

        mockMvc.perform(post("/api/projects/10/milestones")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(milestoneRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("v1.0 Release"));
    }

    @Test
    @WithMockUserPrincipal
    void getMilestones_returnsListForProject() throws Exception {
        when(milestoneService.getMilestonesByProject(eq(10L), any())).thenReturn(List.of(sampleMilestone));

        mockMvc.perform(get("/api/projects/10/milestones"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("v1.0 Release"))
                .andExpect(jsonPath("$[0].id").value(1));
    }

    @Test
    @WithMockUserPrincipal
    void getMilestone_returnsSingleMilestone() throws Exception {
        when(milestoneService.getMilestoneById(1L)).thenReturn(sampleMilestone);

        mockMvc.perform(get("/api/milestones/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("v1.0 Release"));
    }

    @Test
    @WithMockUserPrincipal
    void updateMilestone_returns200WithUpdatedData() throws Exception {
        MilestoneResponseDTO updated = new MilestoneResponseDTO();
        updated.setId(1L);
        updated.setName("v1.1 Release");
        when(milestoneService.updateMilestone(eq(1L), any(), any())).thenReturn(updated);

        mockMvc.perform(put("/api/milestones/1")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(milestoneRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("v1.1 Release"));
    }

    @Test
    @WithMockUserPrincipal
    void deleteMilestone_returns204NoContent() throws Exception {
        doNothing().when(milestoneService).deleteMilestone(anyLong(), any());

        mockMvc.perform(delete("/api/milestones/1").with(csrf()))
                .andExpect(status().isNoContent());

        verify(milestoneService).deleteMilestone(eq(1L), any());
    }

    @Test
    @WithMockUserPrincipal
    void assignMilestone_returns200WhenMilestoneIdProvided() throws Exception {
        doNothing().when(milestoneService).assignTaskToMilestone(anyLong(), any(), any());

        mockMvc.perform(patch("/api/tasks/5/milestone")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("milestoneId", 1))))
                .andExpect(status().isOk());

        verify(milestoneService).assignTaskToMilestone(eq(5L), eq(1L), any());
    }

    @Test
    @WithMockUserPrincipal
    void assignMilestone_returns200WhenMilestoneIdNull_removingMilestone() throws Exception {
        doNothing().when(milestoneService).assignTaskToMilestone(anyLong(), isNull(), any());

        mockMvc.perform(patch("/api/tasks/5/milestone")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"milestoneId\": null}"))
                .andExpect(status().isOk());

        verify(milestoneService).assignTaskToMilestone(eq(5L), isNull(), any());
    }
}
