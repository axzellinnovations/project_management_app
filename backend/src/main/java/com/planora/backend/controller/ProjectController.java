package com.planora.backend.controller;

import com.planora.backend.dto.ProjectDTO;
import com.planora.backend.dto.ProjectResponseDTO; // Import the new DTO
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
    public ResponseEntity<ProjectResponseDTO> createProject(@RequestBody ProjectDTO projectDto) {
        return new ResponseEntity<>(
                projectService.createProject(projectDto),
                HttpStatus.CREATED
        );
    }

    // ---------------- READ ALL PROJECTS ----------------
    @GetMapping
    public ResponseEntity<List<ProjectResponseDTO>> getAllProjects() {
        return new ResponseEntity<>(
                projectService.getAllProjects(),
                HttpStatus.OK
        );
    }

    // ---------------- READ PROJECT BY ID ----------------
    @GetMapping("/{projectId}")
    public ResponseEntity<ProjectResponseDTO> getProjectById(@PathVariable Long projectId) {
        return new ResponseEntity<>(
                projectService.getProjectById(projectId),
                HttpStatus.OK
        );
    }

    // ---------------- UPDATE PROJECT ----------------
    @PutMapping("/{projectId}")
    public ResponseEntity<ProjectResponseDTO> updateProject(
            @PathVariable Long projectId,
            @RequestBody UpdateProjectDTO dto
    ) {
        return new ResponseEntity<>(
                projectService.updateProject(projectId, dto),
                HttpStatus.OK
        );
    }

    // ---------------- DELETE PROJECT (OWNER ONLY) ----------------
    @DeleteMapping("/{projectId}/team/{teamId}")
    public ResponseEntity<Void> deleteProject(
            @PathVariable Long projectId,
            @PathVariable Long teamId,
            @AuthenticationPrincipal(expression = "userId") Long userId
    ) {
        projectService.deleteProject(projectId, teamId, userId);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }
}