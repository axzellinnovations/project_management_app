package com.planora.backend.controller;

import com.planora.backend.dto.ProjectDTO;
import com.planora.backend.dto.ProjectResponseDTO;
import com.planora.backend.dto.ProjectMetricsDTO;
import com.planora.backend.dto.UpdateProjectDTO;
import com.planora.backend.service.ProjectService;
import jakarta.validation.Valid;
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

    // Service layer handles all business rules and database-oriented operations.
    private final ProjectService projectService;


    // Create a new project
    // Flow: request DTO -> set owner from auth principal -> service -> 201 response.
    @PostMapping
    public ResponseEntity<ProjectResponseDTO> createProject(
            @Valid @RequestBody ProjectDTO projectDto,
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal) {
        projectDto.setOwnerId(principal.getUserId());
        return new ResponseEntity<>(
                projectService.createProject(projectDto),
                HttpStatus.CREATED);
    }

    // Check if the project key is available.
    // Returns true when available and false when already used.
    @GetMapping("/check-key")
    public ResponseEntity<Boolean> checkProjectKey(@RequestParam String key) {
        boolean exists = projectService.checkKeyExists(key);
        return ResponseEntity.ok(!exists);
    }

    // Get project-level metrics (task counts, completion, overdue details, etc.).
    @GetMapping("/{projectId}/metrics")
    public ResponseEntity<ProjectMetricsDTO> getProjectMetrics(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(projectService.getProjectMetrics(projectId));
    }

    // List all projects visible to the logged-in user.
    // Optional query params support filter/sort/order.
    @GetMapping
    public ResponseEntity<List<ProjectResponseDTO>> getProjectsForUser(
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String order) {
        return new ResponseEntity<>(
                projectService.getProjectsForUser(principal.getUserId(), type, sort, order),
                HttpStatus.OK);
    }

    // Return recently accessed projects for the logged-in user.
    @GetMapping("/recent")
    public ResponseEntity<List<ProjectResponseDTO>> getRecentProjects(
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal,
            @RequestParam(defaultValue = "5") int limit) {
        return ResponseEntity.ok(projectService.getRecentProjectsForUser(principal.getUserId(), limit));
    }

    // Get favorite projects for the logged-in user.
    @GetMapping("/favorites")
    public ResponseEntity<List<ProjectResponseDTO>> getFavoriteProjects(
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal) {
        return ResponseEntity.ok(projectService.getFavoriteProjectsForUser(principal.getUserId()));
    }

    // Fetch a single project by id with user context for access and favorite state.
    @GetMapping("/{projectId}")
    public ResponseEntity<ProjectResponseDTO> getProjectById(
            @PathVariable Long projectId,
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal) {
        return ResponseEntity.ok(
                projectService.getProjectByIdForUser(projectId, principal.getUserId()));
    }

    // Update editable project fields.
    // Validation is applied on request payload before service execution.
    @PutMapping("/{projectId}")
    public ResponseEntity<ProjectResponseDTO> updateProject(
            @PathVariable Long projectId,
            @Valid @RequestBody UpdateProjectDTO dto) {
        return new ResponseEntity<>(
                projectService.updateProject(projectId, dto),
                HttpStatus.OK);
    }

    // Track project access time for recent-projects ordering.
    @PostMapping("/{projectId}/access")
    public ResponseEntity<Void> recordAccess(
            @PathVariable Long projectId,
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal) {
        projectService.recordProjectAccess(projectId, principal.getUserId());
        return ResponseEntity.ok().build();
    }

    // Toggle project favorite state for the logged-in user.
    // If already favorite -> remove; otherwise -> add.
    @PostMapping("/{projectId}/favorite")
    public ResponseEntity<Void> toggleFavorite(
            @PathVariable Long projectId,
            @AuthenticationPrincipal com.planora.backend.model.UserPrincipal principal) {
        projectService.toggleFavorite(projectId, principal.getUserId());
        return ResponseEntity.ok().build();
    }

    // Delete a project. Owner permission is validated in service layer.
    // Returns 204 when deletion completes successfully.
    @DeleteMapping("/{projectId}/team/{teamId}")
    public ResponseEntity<Void> deleteProject(
            @PathVariable Long projectId,
            @PathVariable Long teamId,
            @AuthenticationPrincipal(expression = "userId") Long userId) {
        projectService.deleteProject(projectId, teamId, userId);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }
}