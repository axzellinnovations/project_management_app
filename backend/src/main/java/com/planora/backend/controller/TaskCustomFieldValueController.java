package com.planora.backend.controller;

import com.planora.backend.dto.CustomFieldDTO;
import com.planora.backend.service.CustomFieldService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Task-scoped custom field value endpoints.
 * Complements CustomFieldController which is project-scoped.
 */
@RestController
@RequestMapping("/api/tasks/{taskId}/custom-field-values")
public class TaskCustomFieldValueController {

    @Autowired
    private CustomFieldService customFieldService;

    /** Returns a flat map of customFieldId → value for a task. */
    @GetMapping
    public ResponseEntity<Map<Long, String>> getValues(@PathVariable Long taskId) {
        List<CustomFieldDTO.ValueDTO> values = customFieldService.getValuesForTask(taskId);
        Map<Long, String> result = new LinkedHashMap<>();
        for (CustomFieldDTO.ValueDTO v : values) {
            result.put(v.getCustomFieldId(), v.getValue());
        }
        return ResponseEntity.ok(result);
    }

    /** Upserts a single custom field value on a task. Body: { customFieldId: Long, value: String } */
    @PutMapping
    public ResponseEntity<Void> setValue(
            @PathVariable Long taskId,
            @RequestBody Map<String, Object> body) {
        Long customFieldId = Long.valueOf(body.get("customFieldId").toString());
        String value = body.get("value") != null ? body.get("value").toString() : "";
        customFieldService.setFieldValue(taskId, customFieldId, value);
        return ResponseEntity.ok().build();
    }
}
