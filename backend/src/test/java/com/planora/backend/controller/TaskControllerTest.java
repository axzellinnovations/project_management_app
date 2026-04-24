package com.planora.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.TaskActivityResponseDTO;
import com.planora.backend.dto.TaskRequestDTO;
import com.planora.backend.dto.TaskResponseDTO;
import com.planora.backend.dto.TaskTemplateDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.model.User;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.TaskActivityService;
import com.planora.backend.service.TaskService;
import com.planora.backend.service.TaskTemplateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.userdetails.UserDetailsService;
import com.planora.backend.annotation.WithMockUserPrincipal;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TaskController.class)
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TaskService service;

    @MockitoBean
    private TaskActivityService activityService;

    @MockitoBean
    private TaskTemplateService templateService;

    @MockitoBean
    private SimpMessagingTemplate messagingTemplate;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    private TaskResponseDTO sampleTask;

    @BeforeEach
    void setUp() {
        sampleTask = new TaskResponseDTO();
        sampleTask.setId(1L);
        sampleTask.setTitle("Implement login");
        sampleTask.setProjectId(10L);
    }

    @Test
    @WithMockUserPrincipal
    void getTaskById_returnsTask() throws Exception {
        when(service.getTaskById(1L)).thenReturn(sampleTask);

        mockMvc.perform(get("/api/tasks/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Implement login"))
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @WithMockUserPrincipal
    void getTasksByProject_returnsListOfTasks() throws Exception {
        when(service.getTasksByProject(eq(10L), any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(sampleTask));

        mockMvc.perform(get("/api/tasks/project/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Implement login"));
    }

    @Test
    @WithMockUserPrincipal
    void deleteTask_returns204NoContent() throws Exception {
        when(service.deleteTask(eq(1L), any())).thenReturn(10L);

        mockMvc.perform(delete("/api/tasks/1").with(csrf()))
                .andExpect(status().isNoContent());

        verify(service).deleteTask(eq(1L), any());
    }

    @Test
    @WithMockUserPrincipal
    void getRecentTasks_returnsTaskList() throws Exception {
        when(service.getRecentTasks(any(), anyInt())).thenReturn(List.of(sampleTask));

        mockMvc.perform(get("/api/tasks/recent").param("limit", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Implement login"));
    }

    @Test
    @WithMockUserPrincipal
    void getAssignedTasks_returnsTaskList() throws Exception {
        when(service.getAssignedTasks(any(), anyInt())).thenReturn(List.of(sampleTask));

        mockMvc.perform(get("/api/tasks/assigned"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1));
    }

    @Test
    @WithMockUserPrincipal
    void getWorkedOnTasks_returnsTaskList() throws Exception {
        when(service.getWorkedOnTasks(any(), anyInt())).thenReturn(List.of(sampleTask));

        mockMvc.perform(get("/api/tasks/worked-on"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1));
    }

    @Test
    @WithMockUserPrincipal
    void recordTaskAccess_returns200() throws Exception {
        doNothing().when(service).recordTaskAccess(anyLong(), any());

        mockMvc.perform(post("/api/tasks/1/access").with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUserPrincipal
    void getActivities_returnsActivityList() throws Exception {
        TaskActivityResponseDTO activity = TaskActivityResponseDTO.builder()
                .id(1L).activityType("CREATED").actorName("admin").description("Task created").createdAt("2024-01-01T00:00:00").build();
        when(activityService.getActivities(1L)).thenReturn(List.of(activity));

        mockMvc.perform(get("/api/tasks/1/activities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].actorName").value("admin"))
                .andExpect(jsonPath("$[0].activityType").value("CREATED"));
    }

    @Test
    @WithMockUserPrincipal
    void updateStatus_returns200WithUpdatedTask() throws Exception {
        sampleTask.setStatus("IN_PROGRESS");
        when(service.updateStatus(eq(1L), eq("IN_PROGRESS"), any())).thenReturn(sampleTask);

        mockMvc.perform(patch("/api/tasks/1/status")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
    }

    @Test
    @WithMockUserPrincipal
    void updatePriority_returns200WithUpdatedTask() throws Exception {
        sampleTask.setPriority("HIGH");
        when(service.updatePriority(eq(1L), eq("HIGH"), any())).thenReturn(sampleTask);

        mockMvc.perform(patch("/api/tasks/1/priority")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"priority\":\"HIGH\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.priority").value("HIGH"));
    }

    @Test
    @WithMockUserPrincipal
    void addLabel_returns200() throws Exception {
        doNothing().when(service).addLabel(anyLong(), anyLong(), any());

        mockMvc.perform(post("/api/tasks/1/label/5").with(csrf()))
                .andExpect(status().isOk());

        verify(service).addLabel(eq(1L), eq(5L), any());
    }

    @Test
    @WithMockUserPrincipal
    void removeLabel_returns200() throws Exception {
        doNothing().when(service).removeLabel(anyLong(), anyLong(), any());

        mockMvc.perform(delete("/api/tasks/1/label/5").with(csrf()))
                .andExpect(status().isOk());

        verify(service).removeLabel(eq(1L), eq(5L), any());
    }

    @Test
    @WithMockUserPrincipal
    void unassignTask_returns204() throws Exception {
        doNothing().when(service).unassignTask(anyLong(), any());

        mockMvc.perform(delete("/api/tasks/1/assignee").with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    @WithMockUserPrincipal
    void reorderTasks_returns400WhenProjectIdMissing() throws Exception {
        mockMvc.perform(patch("/api/tasks/reorder")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderedTaskIds\":[1,2,3]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUserPrincipal
    void saveAsTemplate_returns201WithTemplate() throws Exception {
        TaskTemplateDTO dto = new TaskTemplateDTO(1L, 10L, "My Template", "Title", null, null, 0, List.of(), null, "admin");
        when(templateService.saveTaskAsTemplate(eq(1L), any(), any())).thenReturn(dto);

        TaskTemplateDTO.SaveFromTaskRequest req = new TaskTemplateDTO.SaveFromTaskRequest();
        req.setTemplateName("My Template");

        mockMvc.perform(post("/api/tasks/1/save-as-template")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("My Template"));
    }
}
