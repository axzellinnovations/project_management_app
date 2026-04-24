package com.planora.backend.controller;

import com.planora.backend.annotation.WithMockUserPrincipal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.LabelRequestDTO;
import com.planora.backend.dto.LabelResponseDTO;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.LabelService;
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

@WebMvcTest(LabelController.class)
class LabelControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private LabelService labelService;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    private LabelResponseDTO sampleLabel;
    private LabelRequestDTO labelRequest;

    @BeforeEach
    void setUp() {
        sampleLabel = new LabelResponseDTO();
        sampleLabel.setId(1L);
        sampleLabel.setName("Bug");
        sampleLabel.setColor("#FF0000");

        labelRequest = new LabelRequestDTO();
        labelRequest.setName("Bug");
        labelRequest.setColor("#FF0000");
        labelRequest.setProjectId(10L);
    }

    @Test
    @WithMockUserPrincipal
    void getProjectLabels_returnsLabelList() throws Exception {
        when(labelService.getProjectLabels(eq(10L), any())).thenReturn(List.of(sampleLabel));

        mockMvc.perform(get("/api/labels/project/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Bug"))
                .andExpect(jsonPath("$[0].color").value("#FF0000"));
    }

    @Test
    @WithMockUserPrincipal
    void getProjectLabels_returnsEmptyListWhenNoLabels() throws Exception {
        when(labelService.getProjectLabels(eq(10L), any())).thenReturn(List.of());

        mockMvc.perform(get("/api/labels/project/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    @WithMockUserPrincipal
    void createLabel_returns201WithCreatedLabel() throws Exception {
        when(labelService.createLabel(any(), any())).thenReturn(sampleLabel);

        mockMvc.perform(post("/api/labels")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(labelRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Bug"));
    }

    @Test
    @WithMockUserPrincipal
    void updateLabel_returns200WithUpdatedLabel() throws Exception {
        LabelResponseDTO updated = new LabelResponseDTO();
        updated.setId(1L);
        updated.setName("Updated Bug");
        updated.setColor("#FF1111");
        when(labelService.updateLabel(eq(1L), any(), any())).thenReturn(updated);

        mockMvc.perform(put("/api/labels/1")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(labelRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Bug"));
    }

    @Test
    @WithMockUserPrincipal
    void deleteLabel_returns204NoContent() throws Exception {
        doNothing().when(labelService).deleteLabel(anyLong(), any());

        mockMvc.perform(delete("/api/labels/1").with(csrf()))
                .andExpect(status().isNoContent());

        verify(labelService).deleteLabel(eq(1L), any());
    }
}
