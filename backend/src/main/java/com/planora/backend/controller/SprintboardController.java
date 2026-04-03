package com.planora.backend.controller;

import com.planora.backend.dto.SprintboardResponseDTO;
import com.planora.backend.dto.SprintboardTaskResponseDTO;
import com.planora.backend.dto.SprintcolumnDTO;
import com.planora.backend.model.SprintcolumnStatus;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.SprintboardService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sprintboards")
@CrossOrigin(origins = "http://localhost:3000")
public class SprintboardController {

    private final SprintboardService sprintboardService;

    public SprintboardController(SprintboardService sprintboardService) {
        this.sprintboardService = sprintboardService;
    }

    // GET sprintboard by sprint ID
    @GetMapping("/sprint/{sprintId}")
    public ResponseEntity<SprintboardResponseDTO> getSprintboardBySprintId(@PathVariable Long sprintId) {
        SprintboardResponseDTO sprintboard = sprintboardService.getSprintboardBySprintId(sprintId);
        return new ResponseEntity<>(sprintboard, HttpStatus.OK);
    }

    // GET sprintboard by ID
    @GetMapping("/{sprintboardId}")
    public ResponseEntity<SprintboardResponseDTO> getSprintboardById(@PathVariable Long sprintboardId) {
        SprintboardResponseDTO sprintboard = sprintboardService.getSprintboardBySprintboardId(sprintboardId);
        return new ResponseEntity<>(sprintboard, HttpStatus.OK);
    }

    // GET tasks in a specific column
    @GetMapping("/{sprintboardId}/columns/{columnStatus}/tasks")
    public ResponseEntity<List<SprintboardTaskResponseDTO>> getTasksByColumn(
            @PathVariable Long sprintboardId,
            @PathVariable SprintcolumnStatus columnStatus) {
        List<SprintboardTaskResponseDTO> tasks = sprintboardService.getTasksBySprintColumn(sprintboardId, columnStatus);
        return new ResponseEntity<>(tasks, HttpStatus.OK);
    }

    // MOVE task to different column
    @PutMapping("/tasks/{taskId}/move")
    public ResponseEntity<Void> moveTaskToColumn(
            @PathVariable Long taskId,
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Long sprintboardId = Long.valueOf(request.get("sprintboardId").toString());
        SprintcolumnStatus newColumnStatus = SprintcolumnStatus.valueOf(request.get("newColumnStatus").toString());

        sprintboardService.moveTaskToColumn(taskId, sprintboardId, newColumnStatus, currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.OK);
    }

    // ADD column to sprintboard
    @PostMapping("/{sprintboardId}/columns")
    public ResponseEntity<SprintcolumnDTO> addColumn(
            @PathVariable Long sprintboardId,
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        String name = request.get("name");
        String status = request.get("status");
        return new ResponseEntity<>(sprintboardService.addColumnToSprintboard(sprintboardId, name, status, currentUser.getUserId()), HttpStatus.CREATED);
    }

    // DELETE sprintboard
    @DeleteMapping("/{sprintboardId}")
    public ResponseEntity<Void> deleteSprintboard(@PathVariable Long sprintboardId) {
        sprintboardService.deleteSprintboard(sprintboardId);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }
}