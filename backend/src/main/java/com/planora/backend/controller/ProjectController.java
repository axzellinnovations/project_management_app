package com.planora.backend.controller;

import com.planora.backend.dto.ProjectDTO;
import com.planora.backend.dto.ProjectResponseDTO;
import com.planora.backend.dto.UpdateProjectDTO;
import com.planora.backend.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    // ---------------- CREATE PROJECT ----------------
    @PostMapping
    public ResponseEntity<ProjectResponseDTO> createProject(
            @RequestBody ProjectDTO projectDto,
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal) {
        projectDto.setOwnerId(principal.getUserId());
        return new ResponseEntity<>(
                projectService.createProject(projectDto),
                HttpStatus.CREATED);
    }

    // ---------------- CHECK PROJECT KEY ----------------
    @GetMapping("/check-key")
    public ResponseEntity<Boolean> checkProjectKey(@RequestParam String key) {
        // Return true if available, false if in use
        boolean exists = projectService.checkKeyExists(key);
        return ResponseEntity.ok(!exists);
    }

    // ---------------- READ PROJECTS (FOR AUTH USER) ----------------
    @GetMapping
    public ResponseEntity<List<ProjectResponseDTO>> getProjectsForUser(
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal) {
        return new ResponseEntity<>(
                projectService.getProjectsForUser(principal.getUserId()),
                HttpStatus.OK);
    }

    // ---------------- READ RECENT (FOR AUTH USER) ----------------
    @GetMapping("/recent")
    public ResponseEntity<List<ProjectResponseDTO>> getRecentProjects(
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal,
            @RequestParam(defaultValue = "5") int limit) {
        return ResponseEntity.ok(projectService.getRecentProjectsForUser(principal.getUserId(), limit));
    }

    // ---------------- READ FAVORITES (FOR AUTH USER) ----------------
    @GetMapping("/favorites")
    public ResponseEntity<List<ProjectResponseDTO>> getFavoriteProjects(
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal) {
        return ResponseEntity.ok(projectService.getFavoriteProjectsForUser(principal.getUserId()));
    }

    // ---------------- READ PROJECT BY ID ----------------
    @GetMapping("/{projectId}")
    public ResponseEntity<ProjectResponseDTO> getProjectById(
            @PathVariable Long projectId,
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal) {
        return ResponseEntity.ok(
                projectService.getProjectByIdForUser(projectId, principal.getUserId()));
    }

    // ---------------- UPDATE PROJECT ----------------
    @PutMapping("/{projectId}")
    public ResponseEntity<ProjectResponseDTO> updateProject(
            @PathVariable Long projectId,
            @RequestBody UpdateProjectDTO dto) {
        return new ResponseEntity<>(
                projectService.updateProject(projectId, dto),
                HttpStatus.OK);
    }

    // ---------------- RECORD PROJECT ACCESS ----------------
    @PostMapping("/{projectId}/access")
    public ResponseEntity<Void> recordAccess(
            @PathVariable Long projectId,
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal) {
        projectService.recordProjectAccess(projectId, principal.getUserId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{projectId}/favorite")
    public ResponseEntity<Void> toggleFavorite(
            @PathVariable Long projectId,
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal) {
        projectService.toggleFavorite(projectId, principal.getUserId());
        return ResponseEntity.ok().build();
    }

    // ---------------- DELETE PROJECT (OWNER ONLY) ----------------
    @DeleteMapping("/{projectId}/team/{teamId}")
    public ResponseEntity<Void> deleteProject(
            @PathVariable Long projectId,
            @PathVariable Long teamId,
            @AuthenticationPrincipal(expression = "userId") Long userId) {
        projectService.deleteProject(projectId, teamId, userId);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }
}