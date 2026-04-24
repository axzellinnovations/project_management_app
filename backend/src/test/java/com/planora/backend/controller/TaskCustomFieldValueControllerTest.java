package com.planora.backend.controller;

import com.planora.backend.annotation.WithMockUserPrincipal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.CustomFieldDTO;
import com.planora.backend.service.CustomFieldService;
import com.planora.backend.service.JWTService;
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

@WebMvcTest(TaskCustomFieldValueController.class)
class TaskCustomFieldValueControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CustomFieldService customFieldService;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @WithMockUserPrincipal
    void getValues_returnsMapOfFieldIdToValue() throws Exception {
        CustomFieldDTO.ValueDTO value = new CustomFieldDTO.ValueDTO(1L, "Priority", "SELECT", "High");
        when(customFieldService.getValuesForTask(5L)).thenReturn(List.of(value));

        mockMvc.perform(get("/api/tasks/5/custom-field-values"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.1").value("High"));
    }

    @Test
    @WithMockUserPrincipal
    void getValues_returnsEmptyMapWhenNoValues() throws Exception {
        when(customFieldService.getValuesForTask(5L)).thenReturn(List.of());

        mockMvc.perform(get("/api/tasks/5/custom-field-values"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    @WithMockUserPrincipal
    void setValue_returns200AndUpsertsValue() throws Exception {
        doNothing().when(customFieldService).setFieldValue(anyLong(), anyLong(), anyString());

        Map<String, Object> body = Map.of("customFieldId", 1, "value", "Medium");

        mockMvc.perform(put("/api/tasks/5/custom-field-values")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());

        verify(customFieldService).setFieldValue(5L, 1L, "Medium");
    }

    @Test
    @WithMockUserPrincipal
    void setValue_handlesNullValueAsEmptyString() throws Exception {
        doNothing().when(customFieldService).setFieldValue(anyLong(), anyLong(), anyString());

        String body = "{\"customFieldId\": 1}";

        mockMvc.perform(put("/api/tasks/5/custom-field-values")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        verify(customFieldService).setFieldValue(5L, 1L, "");
    }
}
