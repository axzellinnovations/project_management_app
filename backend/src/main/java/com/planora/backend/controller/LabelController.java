package com.planora.backend.controller;

import com.planora.backend.dto.LabelRequestDTO;
import com.planora.backend.dto.LabelResponseDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.LabelService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/labels")
public class LabelController {

    @Autowired
    private LabelService labelService;

    @GetMapping("/project/{projectId}")
    public ResponseEntity<List<LabelResponseDTO>> getProjectLabels(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(labelService.getProjectLabels(projectId, principal.getUserId()));
    }

    @PostMapping
    public ResponseEntity<LabelResponseDTO> createLabel(
            @RequestBody LabelRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(labelService.createLabel(request, principal.getUserId()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<LabelResponseDTO> updateLabel(
            @PathVariable Long id,
            @RequestBody LabelRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(labelService.updateLabel(id, request, principal.getUserId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLabel(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        labelService.deleteLabel(id, principal.getUserId());
        return ResponseEntity.noContent().build();
    }
}
