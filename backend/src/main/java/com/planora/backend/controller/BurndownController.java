package com.planora.backend.controller;

import com.planora.backend.dto.BurndownResponseDTO;
import com.planora.backend.service.BurndownService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/burndown")
@CrossOrigin
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
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        BurndownResponseDTO data = burndownService.getBurndownData(sprintId, from, to);
        return ResponseEntity.ok(data);
    }
}
