package com.planora.backend.controller;

import com.planora.backend.dto.DashboardBoardDTO;
import com.planora.backend.dto.SprintboardResponseDTO;
import com.planora.backend.dto.SprintboardTaskResponseDTO;
import com.planora.backend.dto.SprintcolumnDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.SprintboardService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sprintboards")
public class SprintboardController {

    private final SprintboardService sprintboardService;

    public SprintboardController(SprintboardService sprintboardService) {
        this.sprintboardService = sprintboardService;
    }

    // GET recent sprintboards for dashboard
    @GetMapping("/user/recent")
    public ResponseEntity<List<DashboardBoardDTO>> getRecentSprintboards(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(defaultValue = "20") int limit) {
        List<DashboardBoardDTO> sprintboards = sprintboardService.getRecentSprintboardsForUser(currentUser.getUserId(), limit);
        return new ResponseEntity<>(sprintboards, HttpStatus.OK);
    }

    // GET sprintboard by sprint ID
    @GetMapping("/sprint/{sprintId}")
    public ResponseEntity<SprintboardResponseDTO> getSprintboardBySprintId(
            @PathVariable Long sprintId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        SprintboardResponseDTO sprintboard = sprintboardService.getSprintboardBySprintId(sprintId, currentUser.getUserId());
        return new ResponseEntity<>(sprintboard, HttpStatus.OK);
    }

    // GET sprintboard by ID
    @GetMapping("/{sprintboardId}")
    public ResponseEntity<SprintboardResponseDTO> getSprintboardById(
            @PathVariable Long sprintboardId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        SprintboardResponseDTO sprintboard = sprintboardService.getSprintboardBySprintboardId(sprintboardId, currentUser.getUserId());
        return new ResponseEntity<>(sprintboard, HttpStatus.OK);
    }

    // GET tasks in a specific column
    @GetMapping("/{sprintboardId}/columns/{columnStatus}/tasks")
    public ResponseEntity<List<SprintboardTaskResponseDTO>> getTasksByColumn(
            @PathVariable Long sprintboardId,
            @PathVariable String columnStatus,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<SprintboardTaskResponseDTO> tasks = sprintboardService.getTasksBySprintColumn(sprintboardId, columnStatus, currentUser.getUserId());
        return new ResponseEntity<>(tasks, HttpStatus.OK);
    }

    // ADD column to sprintboard
    @PostMapping("/{sprintboardId}/columns")
    public ResponseEntity<SprintcolumnDTO> addColumn(
            @PathVariable Long sprintboardId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        String name = body.getOrDefault("name", "New Column");
        String status = body.getOrDefault("status", "TODO");
        SprintcolumnDTO column = sprintboardService.addColumnToSprintboard(sprintboardId, name, status, currentUser.getUserId());
        return new ResponseEntity<>(column, HttpStatus.CREATED);
    }

    // MOVE task to different column
    @PutMapping("/tasks/{taskId}/move")
    public ResponseEntity<Void> moveTaskToColumn(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestBody Map<String, Object> request) {
        Long sprintboardId = Long.valueOf(request.get("sprintboardId").toString());
        String newColumnStatus = request.get("newColumnStatus").toString();

        sprintboardService.moveTaskToColumn(taskId, sprintboardId, newColumnStatus, currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.OK);
    }

    // DELETE sprintboard
    @DeleteMapping("/{sprintboardId}")
    public ResponseEntity<Void> deleteSprintboard(
            @PathVariable Long sprintboardId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        sprintboardService.deleteSprintboard(sprintboardId, currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }
}