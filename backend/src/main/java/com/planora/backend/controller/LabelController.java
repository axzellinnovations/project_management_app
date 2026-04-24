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

    /*
     * Fetches all custom labels associated with a specific project.
     * Usually called once when the Kanban board loads so the frontend can cache them in a state manager (like Redux/Zustand).
     */
    @GetMapping("/project/{projectId}")
    public ResponseEntity<List<LabelResponseDTO>> getProjectLabels(
            @PathVariable Long projectId,
            // SECURITY TRICK: Instead of parsing the HTTP Authorization header manually,
            // Spring Security injects the validated user directly into the method signature.
            @AuthenticationPrincipal UserPrincipal principal) {

        // We pass the userId down to the service layer to ensure this user
        // actually has permission to view this project's labels.
        return ResponseEntity.ok(labelService.getProjectLabels(projectId, principal.getUserId()));
    }

    /*
     * Creates a new label.
     * Note: The target `projectId` is expected to be inside the LabelRequestDTO payload.
     */
    @PostMapping
    public ResponseEntity<LabelResponseDTO> createLabel(
            @RequestBody LabelRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {

        // REST STANDARD: Always return 201 Created when a new resource is successfully inserted into the database.
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(labelService.createLabel(request, principal.getUserId()));
    }

    /*
     * Updates an existing label's name or color.
     * REST STANDARD: Uses @PutMapping because this is an idempotent replacement of the label's data.
     */
    @PutMapping("/{id}")
    public ResponseEntity<LabelResponseDTO> updateLabel(
            @PathVariable Long id,
            @RequestBody LabelRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(labelService.updateLabel(id, request, principal.getUserId()));
    }

    /*
     * Permanently deletes a label.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLabel(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {

        labelService.deleteLabel(id, principal.getUserId());

        // REST STANDARD: Return 204 No Content.
        // The deletion was successful, and there is no JSON body to send back to the client.
        return ResponseEntity.noContent().build();
    }
}
