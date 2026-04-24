package com.planora.backend.controller;

import com.planora.backend.annotation.WithMockUserPrincipal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.*;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.TaskAttachmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TaskAttachmentController.class)
class TaskAttachmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TaskAttachmentService taskAttachmentService;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    private TaskAttachmentResponseDTO sampleAttachment;

    @BeforeEach
    void setUp() {
        sampleAttachment = TaskAttachmentResponseDTO.builder()
                .id(1L)
                .fileName("report.pdf")
                .contentType("application/pdf")
                .fileSize(10240L)
                .downloadUrl("https://s3.example.com/report.pdf?sig=abc")
                .uploadedByName("alice")
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    @WithMockUserPrincipal
    void initUpload_returns200WithUploadInitResponse() throws Exception {
        TaskAttachmentUploadInitRequestDTO initReq = new TaskAttachmentUploadInitRequestDTO();
        initReq.setFileName("report.pdf");
        initReq.setContentType("application/pdf");
        initReq.setFileSize(10240L);

        TaskAttachmentUploadInitResponseDTO initResp = TaskAttachmentUploadInitResponseDTO.builder()
                .uploadUrl("https://s3.example.com/presigned-put")
                .objectKey("task-1/uuid-report.pdf")
                .expiresInSeconds(900L)
                .build();

        when(taskAttachmentService.initUpload(eq(1L), any(), any())).thenReturn(initResp);

        mockMvc.perform(post("/api/tasks/1/attachments/upload/init")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(initReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.objectKey").value("task-1/uuid-report.pdf"))
                .andExpect(jsonPath("$.expiresInSeconds").value(900));
    }

    @Test
    @WithMockUserPrincipal
    void finalizeUpload_returns201WithAttachmentResponse() throws Exception {
        TaskAttachmentUploadFinalizeRequestDTO finalizeReq = new TaskAttachmentUploadFinalizeRequestDTO();
        finalizeReq.setFileName("report.pdf");
        finalizeReq.setContentType("application/pdf");
        finalizeReq.setFileSize(10240L);
        finalizeReq.setObjectKey("task-1/uuid-report.pdf");

        when(taskAttachmentService.finalizeUpload(eq(1L), any(), any())).thenReturn(sampleAttachment);

        mockMvc.perform(post("/api/tasks/1/attachments/upload/finalize")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(finalizeReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileName").value("report.pdf"))
                .andExpect(jsonPath("$.uploadedByName").value("alice"));
    }

    @Test
    @WithMockUserPrincipal
    void listAttachments_returnsAttachmentList() throws Exception {
        when(taskAttachmentService.listAttachments(eq(1L), any())).thenReturn(List.of(sampleAttachment));

        mockMvc.perform(get("/api/tasks/1/attachments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].fileName").value("report.pdf"))
                .andExpect(jsonPath("$[0].contentType").value("application/pdf"));
    }

    @Test
    @WithMockUserPrincipal
    void listAttachments_returnsEmptyListWhenNone() throws Exception {
        when(taskAttachmentService.listAttachments(eq(1L), any())).thenReturn(List.of());

        mockMvc.perform(get("/api/tasks/1/attachments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    @WithMockUserPrincipal
    void deleteAttachment_returns204NoContent() throws Exception {
        doNothing().when(taskAttachmentService).deleteAttachment(anyLong(), anyLong(), any());

        mockMvc.perform(delete("/api/tasks/1/attachments/10").with(csrf()))
                .andExpect(status().isNoContent());

        verify(taskAttachmentService).deleteAttachment(eq(1L), eq(10L), any());
    }
}
