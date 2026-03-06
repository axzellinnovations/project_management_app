package com.planora.backend.controller;

import com.planora.backend.dto.PageDetailResponseDto;
import com.planora.backend.dto.PageRequestDto;
import com.planora.backend.dto.PageSummaryResponseDto;
import com.planora.backend.model.ProjectPage;
import com.planora.backend.service.ProjectPageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
            @RequestBody PageRequestDto request){
        return new ResponseEntity<>(service.createPage(projectId, request), HttpStatus.CREATED);
    }

    @GetMapping("/projects/{projectId}/pages")
    public ResponseEntity<List<PageSummaryResponseDto>> getPagesByProject(
            @PathVariable Long projectId) {
        return new ResponseEntity(service.getProjectPages(projectId), HttpStatus.OK);
    }

    @GetMapping("/pages/{pageId}")
    public ResponseEntity<PageDetailResponseDto> getPage(
            @PathVariable Long pageId) {
        return new ResponseEntity(service.getPageById(pageId), HttpStatus.OK);
    }

    @PutMapping("/pages/{pageId}")
    public ResponseEntity<PageDetailResponseDto> updatePage(
            @PathVariable Long pageId,
            @RequestBody PageRequestDto request) {

        PageDetailResponseDto updatedPage = service.updatePage(pageId, request);
        return new ResponseEntity<>(updatedPage, HttpStatus.OK);
    }

    @DeleteMapping("/pages/{pageId}")
    public ResponseEntity<Void> deletePage(@PathVariable Long pageId) {
        service.deletePage(pageId);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

}
