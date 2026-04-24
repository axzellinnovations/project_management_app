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

    // Creates a new documentation page inside a specific project.
    @PostMapping("/projects/{projectId}/pages")
    public ResponseEntity<ProjectPage> createPage(
            @PathVariable Long projectId,
            @Valid @RequestBody PageRequestDto request,
            // SECURITY TRICK: Using SpEL (expression = "userId") directly extracts
            // the Long ID from the UserPrincipal. This keeps the controller parameter
            // clean and saves us from having to do `currentUser.getUserId()` inside the method.
            @AuthenticationPrincipal(expression = "userId") Long userId){
        return new ResponseEntity<>(service.createPage(projectId, request, userId), HttpStatus.CREATED);
    }

    /*
     * Fetches a lightweight list of all pages for a project's sidebar navigation.
     * API DESIGN: By returning `PageSummaryResponseDto` instead of the full page entity,
     * we omit the heavy rich-text `content` field. This makes the API lightning fast
     * and saves massive amounts of mobile data for the end-user.
     */
    @GetMapping("/projects/{projectId}/pages")
    public ResponseEntity<List<PageSummaryResponseDto>> getPagesByProject(
            @PathVariable Long projectId,
            @AuthenticationPrincipal(expression = "userId") Long userId) {
        return new ResponseEntity<>(
                service.getProjectPages(projectId, userId),
                HttpStatus.OK
        );
    }

    /*
     * Fetches the complete, rich-text content of a single page.
     * REST STANDARD: Uses flat routing (`/pages/{pageId}`) because the page ID alone
     * is enough to uniquely identify the resource in the database.
     */
    @GetMapping("/pages/{pageId}")
    public ResponseEntity<PageDetailResponseDto> getPage(
            @PathVariable Long pageId,
            @AuthenticationPrincipal(expression = "userId") Long userId) {
        return new ResponseEntity<>(service.getPageById(pageId, userId), HttpStatus.OK);
    }

    /*
     * Updates the title or content of an existing page.
     * REST STANDARD: Uses @PutMapping because this completely replaces the existing
     * title and content with the new values provided in the payload.
     */
    @PutMapping("/pages/{pageId}")
    public ResponseEntity<PageDetailResponseDto> updatePage(
            @PathVariable Long pageId,
            @Valid @RequestBody PageRequestDto request,
            @AuthenticationPrincipal(expression = "userId") Long userId) {

        PageDetailResponseDto updatedPage = service.updatePage(pageId, request, userId);
        return new ResponseEntity<>(updatedPage, HttpStatus.OK);
    }

    /*
     * Permanently deletes a documentation page.
     * REST STANDARD: Returns a 204 No Content status code upon success,
     * indicating the server fulfilled the request and there is no additional payload to send.
     */
    @DeleteMapping("/pages/{pageId}")
    public ResponseEntity<Void> deletePage(
            @PathVariable Long pageId,
            @AuthenticationPrincipal(expression = "userId") Long userId) {
        service.deletePage(pageId, userId);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

}
