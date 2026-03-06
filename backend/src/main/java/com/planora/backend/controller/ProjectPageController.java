package com.planora.backend.controller;

import com.planora.backend.dto.PageDetailResponseDto;
import com.planora.backend.dto.PageRequestDto;
import com.planora.backend.dto.PageSummaryResponseDto;
import com.planora.backend.model.ProjectPage;
import com.planora.backend.service.ProjectPageService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ProjectPageController {

    @Autowired
    private ProjectPageService service;

    @PostMapping("/projects/{projectId}/pages")
    public ResponseEntity<ProjectPage> createPage(
            @PathVariable Long projectId,
            @Valid @RequestBody PageRequestDto request,
            @AuthenticationPrincipal(expression = "userId") Long userId){
        return new ResponseEntity<>(service.createPage(projectId, request, userId), HttpStatus.CREATED);
    }

    @GetMapping("/projects/{projectId}/pages")
    public ResponseEntity<List<PageSummaryResponseDto>> getPagesByProject(
            @PathVariable Long projectId,
            @AuthenticationPrincipal(expression = "userId") Long userId) {
        return new ResponseEntity<>(
                service.getProjectPages(projectId, userId),
                HttpStatus.OK
        );
    }

    @GetMapping("/pages/{pageId}")
    public ResponseEntity<PageDetailResponseDto> getPage(
            @PathVariable Long pageId,
            @AuthenticationPrincipal(expression = "userId") Long userId) {
        return new ResponseEntity<>(service.getPageById(pageId, userId), HttpStatus.OK);
    }

    @PutMapping("/pages/{pageId}")
    public ResponseEntity<PageDetailResponseDto> updatePage(
            @PathVariable Long pageId,
            @Valid @RequestBody PageRequestDto request,
            @AuthenticationPrincipal(expression = "userId") Long userId) {

        PageDetailResponseDto updatedPage = service.updatePage(pageId, request, userId);
        return new ResponseEntity<>(updatedPage, HttpStatus.OK);
    }

    @DeleteMapping("/pages/{pageId}")
    public ResponseEntity<Void> deletePage(
            @PathVariable Long pageId,
            @AuthenticationPrincipal(expression = "userId") Long userId) {
        service.deletePage(pageId, userId);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

}
