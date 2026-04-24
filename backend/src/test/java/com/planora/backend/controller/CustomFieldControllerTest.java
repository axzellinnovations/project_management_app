package com.planora.backend.controller;

import com.planora.backend.annotation.WithMockUserPrincipal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.CustomFieldDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.model.User;
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

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CustomFieldController.class)
class CustomFieldControllerTest {

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

    private CustomFieldDTO sampleFieldDTO;
    private CustomFieldDTO.UpsertRequest upsertRequest;

    @BeforeEach
    void setUp() {
        sampleFieldDTO = new CustomFieldDTO(1L, 10L, "Priority", "SELECT", List.of("Low", "Medium", "High"), 0);
        upsertRequest = new CustomFieldDTO.UpsertRequest();
        upsertRequest.setName("Priority");
        upsertRequest.setFieldType("SELECT");
        upsertRequest.setPosition(0);
        upsertRequest.setOptions(List.of("Low", "Medium", "High"));
    }

    @Test
    @WithMockUserPrincipal
    void getFields_returnsListOfCustomFields() throws Exception {
        when(customFieldService.getFieldsForProject(10L)).thenReturn(List.of(sampleFieldDTO));

        mockMvc.perform(get("/api/projects/10/custom-fields"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("Priority"));
    }

    @Test
    @WithMockUserPrincipal
    void getFields_returnsEmptyListWhenNoFields() throws Exception {
        when(customFieldService.getFieldsForProject(10L)).thenReturn(List.of());

        mockMvc.perform(get("/api/projects/10/custom-fields"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    @WithMockUserPrincipal
    void createField_returns201Created() throws Exception {
        when(customFieldService.createField(eq(10L), any())).thenReturn(sampleFieldDTO);

        mockMvc.perform(post("/api/projects/10/custom-fields")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(upsertRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Priority"))
                .andExpect(jsonPath("$.fieldType").value("SELECT"));
    }

    @Test
    @WithMockUserPrincipal
    void updateField_returns200Ok() throws Exception {
        when(customFieldService.updateField(eq(1L), any())).thenReturn(sampleFieldDTO);

        mockMvc.perform(put("/api/projects/10/custom-fields/1")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(upsertRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @WithMockUserPrincipal
    void deleteField_returns204NoContent() throws Exception {
        doNothing().when(customFieldService).deleteField(1L);

        mockMvc.perform(delete("/api/projects/10/custom-fields/1")
                        .with(csrf()))
                .andExpect(status().isNoContent());

        verify(customFieldService).deleteField(1L);
    }

    @Test
    @WithMockUserPrincipal
    void setTaskFieldValue_returns200Ok() throws Exception {
        CustomFieldDTO.SetValueRequest req = new CustomFieldDTO.SetValueRequest();
        req.setValue("High");
        doNothing().when(customFieldService).setFieldValue(anyLong(), anyLong(), anyString());

        mockMvc.perform(put("/api/projects/10/custom-fields/1/tasks/5/value")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        verify(customFieldService).setFieldValue(5L, 1L, "High");
    }

    @Test
    @WithMockUserPrincipal
    void getTaskFieldValues_returnsValueDTOList() throws Exception {
        CustomFieldDTO.ValueDTO valueDTO = new CustomFieldDTO.ValueDTO(1L, "Priority", "SELECT", "High");
        when(customFieldService.getValuesForTask(5L)).thenReturn(List.of(valueDTO));

        mockMvc.perform(get("/api/projects/10/custom-fields/tasks/5/values"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].value").value("High"));
    }
}
