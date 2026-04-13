package com.planora.backend.controller;

import com.planora.backend.dto.MilestoneRequestDTO;
import com.planora.backend.dto.MilestoneResponseDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.MilestoneService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@Tag(name = "Milestones", description = "Milestone management for projects")
public class MilestoneController {

    @Autowired
    private MilestoneService milestoneService;

    private Long currentUserId(Authentication auth) {
        return ((UserPrincipal) auth.getPrincipal()).getUserId();
    }

    @Operation(summary = "Create a milestone for a project")
    @ApiResponse(responseCode = "200", description = "Milestone created")
    @PostMapping("/api/projects/{projectId}/milestones")
    public ResponseEntity<MilestoneResponseDTO> createMilestone(
            @PathVariable Long projectId,
            @RequestBody MilestoneRequestDTO dto,
            Authentication auth) {
        return ResponseEntity.ok(milestoneService.createMilestone(projectId, dto, currentUserId(auth)));
    }

    @Operation(summary = "Get all milestones for a project")
    @ApiResponse(responseCode = "200", description = "Success")
    @GetMapping("/api/projects/{projectId}/milestones")
    public ResponseEntity<List<MilestoneResponseDTO>> getMilestones(
            @PathVariable Long projectId,
            Authentication auth) {
        return ResponseEntity.ok(milestoneService.getMilestonesByProject(projectId, currentUserId(auth)));
    }

    @Operation(summary = "Get a single milestone")
    @GetMapping("/api/milestones/{milestoneId}")
    public ResponseEntity<MilestoneResponseDTO> getMilestone(@PathVariable Long milestoneId) {
        return ResponseEntity.ok(milestoneService.getMilestoneById(milestoneId));
    }

    @Operation(summary = "Update a milestone")
    @PutMapping("/api/milestones/{milestoneId}")
    public ResponseEntity<MilestoneResponseDTO> updateMilestone(
            @PathVariable Long milestoneId,
            @RequestBody MilestoneRequestDTO dto,
            Authentication auth) {
        return ResponseEntity.ok(milestoneService.updateMilestone(milestoneId, dto, currentUserId(auth)));
    }

    @Operation(summary = "Delete a milestone")
    @DeleteMapping("/api/milestones/{milestoneId}")
    public ResponseEntity<Void> deleteMilestone(
            @PathVariable Long milestoneId,
            Authentication auth) {
        milestoneService.deleteMilestone(milestoneId, currentUserId(auth));
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Assign or remove a milestone from a task")
    @PatchMapping("/api/tasks/{taskId}/milestone")
    public ResponseEntity<Void> assignMilestone(
            @PathVariable Long taskId,
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        Object milestoneIdObj = body.get("milestoneId");
        Long milestoneId = milestoneIdObj != null
                ? Long.valueOf(milestoneIdObj.toString())
                : null;
        milestoneService.assignTaskToMilestone(taskId, milestoneId, currentUserId(auth));
        return ResponseEntity.ok().build();
    }
}
