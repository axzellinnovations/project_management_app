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

    /*
     * Fetches all populated custom field data for a specific task.
     * API DESIGN: Instead of returning a complex nested list of objects, we return a flat
     * Key-Value map (FieldID -> Value). This provides O(1) lookup time for the frontend
     * client (React/Angular), making it incredibly fast to render the task details page.
     */
    @GetMapping
    public ResponseEntity<Map<Long, String>> getValues(@PathVariable Long taskId) {
        List<CustomFieldDTO.ValueDTO> values = customFieldService.getValuesForTask(taskId);

        // Step 1: Use LinkedHashMap to preserve the sorting order defined by the database.
        // If the project manager arranged the "Cost" field to appear before the "Client" field,
        // using LinkedHashMap guarantees the JSON sent to the frontend keeps that exact order.
        Map<Long, String> result = new LinkedHashMap<>();
        for (CustomFieldDTO.ValueDTO v : values) {
            result.put(v.getCustomFieldId(), v.getValue());
        }
        return ResponseEntity.ok(result);
    }

    /*
     * Upserts (Updates or Inserts) a single custom field value on a task.
     * REST STANDARD: We use @PutMapping because this operation is Idempotent.
     * Sending {customFieldId: 5, value: "High"} ten times in a row results in the exact
     * same database state as sending it once.
     */
    @PutMapping
    public ResponseEntity<Void> setValue(
            @PathVariable Long taskId,
            // Using a generic Map for the request body avoids the overhead of creating
            // a tiny, single-use DTO class just for two fields, keeping the codebase clean.
            @RequestBody Map<String, Object> body) {

        // Step 1: Safely extract and cast the payload data.
        Long customFieldId = Long.valueOf(body.get("customFieldId").toString());

        // Step 2: Handle nulls gracefully. If the user clears a text input on the frontend,
        // we save an empty string rather than crashing the backend with a NullPointerException.
        String value = body.get("value") != null ? body.get("value").toString() : "";

        // Step 3: Delegate the actual database upsert to the service layer.
        customFieldService.setFieldValue(taskId, customFieldId, value);

        // Return 200 OK with no body.
        return ResponseEntity.ok().build();
    }
}
