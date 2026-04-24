package com.planora.backend.controller;

import com.planora.backend.annotation.WithMockUserPrincipal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.TaskActivityResponseDTO;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.TaskActivityService;
import com.planora.backend.service.TaskService;
import com.planora.backend.service.TaskTemplateService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Dedicated tests for the task-activity endpoint hosted inside TaskController.
 */
@WebMvcTest(TaskController.class)
class TaskActivityControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TaskService taskService;

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

    @Test
    @WithMockUserPrincipal
    void getActivities_returnsActivitiesForTask() throws Exception {
        TaskActivityResponseDTO activity = TaskActivityResponseDTO.builder()
                .id(1L)
                .activityType("STATUS_CHANGED")
                .actorName("john")
                .description("Status changed to IN_PROGRESS")
                .createdAt("2024-06-01T12:00:00")
                .build();
        when(activityService.getActivities(5L)).thenReturn(List.of(activity));

        mockMvc.perform(get("/api/tasks/5/activities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].activityType").value("STATUS_CHANGED"))
                .andExpect(jsonPath("$[0].actorName").value("john"))
                .andExpect(jsonPath("$[0].description").value("Status changed to IN_PROGRESS"));
    }

    @Test
    @WithMockUserPrincipal
    void getActivities_returnsEmptyListWhenNoActivity() throws Exception {
        when(activityService.getActivities(99L)).thenReturn(List.of());

        mockMvc.perform(get("/api/tasks/99/activities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }
}
