package com.planora.backend.controller;

import com.planora.backend.dto.CustomFieldDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.CustomFieldService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}/custom-fields")
public class CustomFieldController {

    @Autowired
    private CustomFieldService customFieldService;

    @GetMapping
    public ResponseEntity<List<CustomFieldDTO>> getFields(@PathVariable Long projectId) {
        return ResponseEntity.ok(customFieldService.getFieldsForProject(projectId));
    }

    @PostMapping
    public ResponseEntity<CustomFieldDTO> createField(
            @PathVariable Long projectId,
            @RequestBody CustomFieldDTO.UpsertRequest req,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(customFieldService.createField(projectId, req));
    }

    @PutMapping("/{fieldId}")
    public ResponseEntity<CustomFieldDTO> updateField(
            @PathVariable Long projectId,
            @PathVariable Long fieldId,
            @RequestBody CustomFieldDTO.UpsertRequest req,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(customFieldService.updateField(fieldId, req));
    }

    @DeleteMapping("/{fieldId}")
    public ResponseEntity<Void> deleteField(
            @PathVariable Long projectId,
            @PathVariable Long fieldId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        customFieldService.deleteField(fieldId);
        return ResponseEntity.noContent().build();
    }

    /** Set a custom field value on a specific task */
    @PutMapping("/{fieldId}/tasks/{taskId}/value")
    public ResponseEntity<Void> setTaskFieldValue(
            @PathVariable Long projectId,
            @PathVariable Long fieldId,
            @PathVariable Long taskId,
            @RequestBody CustomFieldDTO.SetValueRequest req,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        customFieldService.setFieldValue(taskId, fieldId, req.getValue());
        return ResponseEntity.ok().build();
    }

    /** Get all custom field values for a task */
    @GetMapping("/tasks/{taskId}/values")
    public ResponseEntity<List<CustomFieldDTO.ValueDTO>> getTaskFieldValues(
            @PathVariable Long projectId,
            @PathVariable Long taskId) {
        return ResponseEntity.ok(customFieldService.getValuesForTask(taskId));
    }
}
