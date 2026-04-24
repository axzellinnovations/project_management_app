package com.planora.backend.controller;

import com.planora.backend.dto.TaskTemplateDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.TaskTemplateService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}/templates")
public class TaskTemplateController {

    @Autowired
    private TaskTemplateService templateService;

    /*
     * Fetches all available templates for a specific project.
     * API DESIGN: This is typically called when the user opens the "Create Task" modal
     * to populate a dropdown menu of available templates.
     */
    @GetMapping
    public ResponseEntity<List<TaskTemplateDTO>> getTemplates(@PathVariable Long projectId) {
        return ResponseEntity.ok(templateService.getTemplates(projectId));
    }

    /*
     * Creates a new, blank template from user input.
     * Note: Creating a template from an *existing* task is handled in the TaskController
     * (`/api/tasks/{taskId}/save-as-template`) because its primary context is the Task, not the Project.
     */
    @PostMapping
    public ResponseEntity<TaskTemplateDTO> createTemplate(
            @PathVariable Long projectId,
            @RequestBody TaskTemplateDTO.CreateRequest req,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(templateService.createTemplate(projectId, req, currentUser.getUserId()));
    }

    /*
     * Deletes a template permanently.
     * REST STANDARD: We return 204 No Content for successful deletions.
     */
    @DeleteMapping("/{templateId}")
    public ResponseEntity<Void> deleteTemplate(
            @PathVariable Long projectId,
            @PathVariable Long templateId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        templateService.deleteTemplate(templateId);
        return ResponseEntity.noContent().build();
    }
}
