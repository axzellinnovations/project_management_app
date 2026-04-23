package com.planora.backend.controller;

import com.planora.backend.annotation.WithMockUserPrincipal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.PageDetailResponseDto;
import com.planora.backend.dto.PageRequestDto;
import com.planora.backend.dto.PageSummaryResponseDto;
import com.planora.backend.model.ProjectPage;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.ProjectPageService;
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

@WebMvcTest(ProjectPageController.class)
class ProjectPageControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProjectPageService service;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    private PageRequestDto pageRequest;
    private PageDetailResponseDto pageDetail;
    private PageSummaryResponseDto pageSummary;

    @BeforeEach
    void setUp() {
        pageRequest = new PageRequestDto();
        pageRequest.setTitle("My First Page");
        pageRequest.setContent("Hello world");

        pageDetail = new PageDetailResponseDto();
        pageDetail.setId(1L);
        pageDetail.setTitle("My First Page");

        pageSummary = new PageSummaryResponseDto();
        pageSummary.setId(1L);
        pageSummary.setTitle("My First Page");
    }

    @Test
    @WithMockUserPrincipal
    void createPage_returns201WithCreatedPage() throws Exception {
        ProjectPage page = new ProjectPage();
        page.setId(1L);
        page.setTitle("My First Page");
        when(service.createPage(eq(10L), any(), any())).thenReturn(page);

        mockMvc.perform(post("/api/projects/10/pages")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pageRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("My First Page"));
    }

    @Test
    @WithMockUserPrincipal
    void getPagesByProject_returnsPageSummaryList() throws Exception {
        when(service.getProjectPages(eq(10L), any())).thenReturn(List.of(pageSummary));

        mockMvc.perform(get("/api/projects/10/pages"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("My First Page"))
                .andExpect(jsonPath("$[0].id").value(1));
    }

    @Test
    @WithMockUserPrincipal
    void getPage_returnsSinglePageDetail() throws Exception {
        when(service.getPageById(eq(1L), any())).thenReturn(pageDetail);

        mockMvc.perform(get("/api/pages/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.title").value("My First Page"));
    }

    @Test
    @WithMockUserPrincipal
    void updatePage_returns200WithUpdatedPage() throws Exception {
        pageDetail.setTitle("Updated Page Title");
        when(service.updatePage(eq(1L), any(), any())).thenReturn(pageDetail);

        mockMvc.perform(put("/api/pages/1")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pageRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated Page Title"));
    }

    @Test
    @WithMockUserPrincipal
    void deletePage_returns204NoContent() throws Exception {
        doNothing().when(service).deletePage(anyLong(), any());

        mockMvc.perform(delete("/api/pages/1").with(csrf()))
                .andExpect(status().isNoContent());

        verify(service).deletePage(eq(1L), any());
    }
}
