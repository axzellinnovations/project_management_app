package com.planora.backend.controller;

import com.planora.backend.dto.BurndownResponseDTO;
import com.planora.backend.dto.SprintVelocityDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.BurndownService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/burndown")
public class BurndownController {

    private final BurndownService burndownService;

    public BurndownController(BurndownService burndownService) {
        this.burndownService = burndownService;
    }

    /**
     * GET /api/burndown/sprint/{sprintId}?from=YYYY-MM-DD&to=YYYY-MM-DD
     *
     * Returns burndown chart data for the given sprint.
     * {@code from} and {@code to} are optional; they default to the sprint's own dates.
     */
    @GetMapping("/sprint/{sprintId}")
    public ResponseEntity<BurndownResponseDTO> getBurndown(
            @PathVariable Long sprintId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        BurndownResponseDTO data = burndownService.getBurndownData(sprintId, from, to, currentUser.getUserId());
        return ResponseEntity.ok(data);
    }

    /**
     * GET /api/burndown/project/{projectId}/velocity
     *
     * Returns committed vs completed story points for every COMPLETED sprint
     * in the project, ordered oldest → newest.
     */
    @GetMapping("/project/{projectId}/velocity")
    public ResponseEntity<List<SprintVelocityDTO>> getVelocity(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        List<SprintVelocityDTO> data = burndownService.getVelocityData(projectId, currentUser.getUserId());
        return ResponseEntity.ok(data);
    }
}

