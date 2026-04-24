package com.planora.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.*;
import com.planora.backend.service.DocumentService;
import com.planora.backend.service.JWTService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
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

@WebMvcTest(DocumentController.class)
class DocumentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DocumentService documentService;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    private DocumentResponseDTO sampleDoc;
    private DocumentFolderResponseDTO sampleFolder;

    @BeforeEach
    void setUp() {
        sampleDoc = DocumentResponseDTO.builder()
                .id(1L)
                .name("spec.pdf")
                .projectId(10L)
                .build();

        sampleFolder = DocumentFolderResponseDTO.builder()
                .id(1L)
                .name("Requirements")
                .build();
    }

    @Test
    @WithMockUserPrincipal
    void initUpload_returns200WithPresignedUrl() throws Exception {
        DocumentUploadInitRequestDTO req = new DocumentUploadInitRequestDTO();
        req.setFileName("spec.pdf");
        req.setContentType("application/pdf");
        req.setFileSize(50000L);

        DocumentUploadInitResponseDTO resp = DocumentUploadInitResponseDTO.builder()
                .uploadUrl("https://s3.example.com/presigned")
                .objectKey("project-10/uuid-spec.pdf")
                .build();

        when(documentService.initUpload(eq(10L), any(), any())).thenReturn(resp);

        mockMvc.perform(post("/api/projects/10/documents/upload/init")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.objectKey").value("project-10/uuid-spec.pdf"));
    }

    @Test
    @WithMockUserPrincipal
    void finalizeUpload_returns201WithDocument() throws Exception {
        DocumentUploadFinalizeRequestDTO req = new DocumentUploadFinalizeRequestDTO();
        req.setFileName("spec.pdf");
        req.setContentType("application/pdf");
        req.setFileSize(50000L);
        req.setObjectKey("project-10/uuid-spec.pdf");

        when(documentService.finalizeUpload(eq(10L), any(), any())).thenReturn(sampleDoc);

        mockMvc.perform(post("/api/projects/10/documents/upload/finalize")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("spec.pdf"));
    }

    @Test
    @WithMockUserPrincipal
    void listDocuments_returns200WithDocumentList() throws Exception {
        when(documentService.listDocuments(eq(10L), any(), any(), anyBoolean())).thenReturn(List.of(sampleDoc));

        mockMvc.perform(get("/api/projects/10/documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("spec.pdf"));
    }

    @Test
    @WithMockUserPrincipal
    void getDocumentById_returns200WithDocument() throws Exception {
        when(documentService.getDocumentById(eq(10L), eq(1L), any())).thenReturn(sampleDoc);

        mockMvc.perform(get("/api/projects/10/documents/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @WithMockUserPrincipal
    void getDownloadUrl_returns200WithUrl() throws Exception {
        when(documentService.getDownloadUrl(eq(10L), eq(1L), any())).thenReturn("https://cdn.example.com/spec.pdf?sig=abc");

        mockMvc.perform(get("/api/projects/10/documents/1/download-url"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.downloadUrl").value("https://cdn.example.com/spec.pdf?sig=abc"));
    }

    @Test
    @WithMockUserPrincipal
    void softDelete_returns204() throws Exception {
        doNothing().when(documentService).softDelete(eq(10L), eq(1L), any());

        mockMvc.perform(delete("/api/projects/10/documents/1").with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    @WithMockUserPrincipal
    void restore_returns200WithDocument() throws Exception {
        when(documentService.restore(eq(10L), eq(1L), any())).thenReturn(sampleDoc);

        mockMvc.perform(patch("/api/projects/10/documents/1/restore").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("spec.pdf"));
    }

    @Test
    @WithMockUserPrincipal
    void permanentDelete_returns204() throws Exception {
        doNothing().when(documentService).permanentDelete(eq(10L), eq(1L), any());

        mockMvc.perform(delete("/api/projects/10/documents/1/permanent").with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    @WithMockUserPrincipal
    void createFolder_returns201WithFolder() throws Exception {
        DocumentFolderCreateRequestDTO req = new DocumentFolderCreateRequestDTO();
        req.setName("Requirements");
        when(documentService.createFolder(eq(10L), any(), any())).thenReturn(sampleFolder);

        mockMvc.perform(post("/api/projects/10/folders")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Requirements"));
    }

    @Test
    @WithMockUserPrincipal
    void listFolders_returns200WithFolderList() throws Exception {
        when(documentService.listFolders(eq(10L), any())).thenReturn(List.of(sampleFolder));

        mockMvc.perform(get("/api/projects/10/folders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Requirements"));
    }

    @Test
    @WithMockUserPrincipal
    void deleteFolder_returns204() throws Exception {
        doNothing().when(documentService).deleteFolder(eq(10L), eq(1L), any());

        mockMvc.perform(delete("/api/projects/10/folders/1").with(csrf()))
                .andExpect(status().isNoContent());
    }
}
