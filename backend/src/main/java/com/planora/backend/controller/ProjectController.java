package com.planora.backend.controller;

import com.planora.backend.model.Project;
import com.planora.backend.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    // CREATE Project
    @PostMapping
    public ResponseEntity<Project> createProject(@RequestBody Project project) {
        return new ResponseEntity<>(
                projectService.createProject(project),
                HttpStatus.CREATED
        );
    }

    // READ All Projects
    @GetMapping
    public ResponseEntity<List<Project>> getAllProjects() {
        return new ResponseEntity<>(
                projectService.getAllProjects(),
                HttpStatus.OK
        );
    }

    // READ Project by ID
    @GetMapping("/{id}")
    public ResponseEntity<Project> getProjectById(@PathVariable Long id) {
        return new ResponseEntity<>(
                projectService.getProjectById(id),
                HttpStatus.OK
        );
    }

    // UPDATE Project
    @PutMapping("/{id}")
    public ResponseEntity<Project> updateProject(
            @PathVariable Long id,
            @RequestBody Project project
    ) {
        return new ResponseEntity<>(
                projectService.updateProject(id, project),
                HttpStatus.OK
        );
    }

    // DELETE Project
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProject(@PathVariable Long id) {
        projectService.deleteProject(id);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }
}
