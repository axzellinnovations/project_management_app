package com.planora.backend.controller;

import com.planora.backend.annotation.WithMockUserPrincipal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.TaskTemplateDTO;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.TaskTemplateService;
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

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TaskTemplateController.class)
class TaskTemplateControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TaskTemplateService templateService;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    private TaskTemplateDTO sampleTemplate;

    @BeforeEach
    void setUp() {
        sampleTemplate = new TaskTemplateDTO(
                1L, 10L, "Bug Template", "Fix a bug", "Standard bug fix description",
                "HIGH", 3, List.of(), null, "admin"
        );
    }

    @Test
    @WithMockUserPrincipal
    void getTemplates_returnsListForProject() throws Exception {
        when(templateService.getTemplates(10L)).thenReturn(List.of(sampleTemplate));

        mockMvc.perform(get("/api/projects/10/templates"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Bug Template"))
                .andExpect(jsonPath("$[0].title").value("Fix a bug"));
    }

    @Test
    @WithMockUserPrincipal
    void getTemplates_returnsEmptyList() throws Exception {
        when(templateService.getTemplates(10L)).thenReturn(List.of());

        mockMvc.perform(get("/api/projects/10/templates"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    @WithMockUserPrincipal
    void createTemplate_returns201WithCreatedTemplate() throws Exception {
        TaskTemplateDTO.CreateRequest createReq = new TaskTemplateDTO.CreateRequest();
        createReq.setName("Bug Template");
        createReq.setTitle("Fix a bug");
        createReq.setDescription("Standard bug fix");
        createReq.setPriority("HIGH");

        when(templateService.createTemplate(eq(10L), any(), any())).thenReturn(sampleTemplate);

        mockMvc.perform(post("/api/projects/10/templates")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Bug Template"));
    }

    @Test
    @WithMockUserPrincipal
    void deleteTemplate_returns204NoContent() throws Exception {
        doNothing().when(templateService).deleteTemplate(1L);

        mockMvc.perform(delete("/api/projects/10/templates/1").with(csrf()))
                .andExpect(status().isNoContent());

        verify(templateService).deleteTemplate(1L);
    }
}
