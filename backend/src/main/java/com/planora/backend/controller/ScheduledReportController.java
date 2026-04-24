package com.planora.backend.controller;

import com.planora.backend.dto.ScheduledReportRequestDTO;
import com.planora.backend.dto.ScheduledReportResponseDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.ScheduledReportService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST endpoints for managing scheduled report configurations.
 *
 * POST   /api/scheduled-reports
 * GET    /api/scheduled-reports/project/{projectId}
 * DELETE /api/scheduled-reports/{id}
 * PATCH  /api/scheduled-reports/{id}/pause
 * PATCH  /api/scheduled-reports/{id}/resume
 */
@RestController
@RequestMapping("/api/scheduled-reports")
public class ScheduledReportController {

    private final ScheduledReportService service;

    public ScheduledReportController(ScheduledReportService service) {
        this.service = service;
    }

    /** Create a new scheduled report. */
    @PostMapping
    public ResponseEntity<ScheduledReportResponseDTO> create(
            @Valid @RequestBody ScheduledReportRequestDTO dto,
            @AuthenticationPrincipal UserPrincipal principal) {

        Long userId = principal != null ? principal.getUserId() : 0L;
        ScheduledReportResponseDTO result = service.create(dto, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    /** List all scheduled reports for a project. */
    @GetMapping("/project/{projectId}")
    public ResponseEntity<List<ScheduledReportResponseDTO>> listByProject(
            @PathVariable Long projectId) {

        return ResponseEntity.ok(service.listByProject(projectId));
    }

    /** Delete a scheduled report by id. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Pause a scheduled report. */
    @PatchMapping("/{id}/pause")
    public ResponseEntity<ScheduledReportResponseDTO> pause(@PathVariable Long id) {
        return ResponseEntity.ok(service.pause(id));
    }

    /** Resume a paused scheduled report. */
    @PatchMapping("/{id}/resume")
    public ResponseEntity<ScheduledReportResponseDTO> resume(@PathVariable Long id) {
        return ResponseEntity.ok(service.resume(id));
    }
}
