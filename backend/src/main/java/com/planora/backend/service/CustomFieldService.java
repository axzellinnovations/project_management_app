package com.planora.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.CustomFieldDTO;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.CustomField;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskFieldValue;
import com.planora.backend.repository.CustomFieldRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskFieldValueRepository;
import com.planora.backend.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CustomFieldService {

    @Autowired private CustomFieldRepository customFieldRepository;
    @Autowired private TaskFieldValueRepository taskFieldValueRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private TaskRepository taskRepository;

    // Jackson ObjectMapper used for serializing Java Lists into JSON strings for DB storage.
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional(readOnly = true)
    public List<CustomFieldDTO> getFieldsForProject(Long projectId) {
        return customFieldRepository.findByProjectIdOrderByPosition(projectId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public CustomFieldDTO createField(Long projectId, CustomFieldDTO.UpsertRequest req) {
        // Step 1: Ensure the project exists.
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        // Step 2: Build the field definition.
        CustomField field = new CustomField();
        field.setProject(project);
        field.setName(req.getName()); // e.g., "Department"
        field.setFieldType(req.getFieldType()); // e.g., "DROPDOWN" or "TEXT"
        field.setPosition(req.getPosition()); // Determines UI rendering order

        // Step 3: If it's a dropdown, serialize the list of choices (e.g., ["HR", "IT", "Sales"]) into JSON.
        if (req.getOptions() != null && !req.getOptions().isEmpty()) {
            field.setOptions(toJson(req.getOptions()));
        }
        return toDTO(customFieldRepository.save(field));
    }

    @Transactional
    public CustomFieldDTO updateField(Long fieldId, CustomFieldDTO.UpsertRequest req) {
        // Step 1: Fetch existing field.
        CustomField field = customFieldRepository.findById(fieldId)
                .orElseThrow(() -> new ResourceNotFoundException("Custom field not found"));

        // Step 2: Apply updates.
        field.setName(req.getName());
        field.setFieldType(req.getFieldType());
        field.setPosition(req.getPosition());
        field.setOptions(req.getOptions() != null ? toJson(req.getOptions()) : null);
        return toDTO(customFieldRepository.save(field));
    }

    @Transactional
    public void deleteField(Long fieldId) {
        customFieldRepository.findById(fieldId)
                .orElseThrow(() -> new ResourceNotFoundException("Custom field not found"));
        customFieldRepository.deleteById(fieldId);
    }

    @Transactional
    public void setFieldValue(Long taskId, Long fieldId, String value) {
        // Step 1: Validate both the task and the field definition exist.
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        CustomField field = customFieldRepository.findById(fieldId)
                .orElseThrow(() -> new ResourceNotFoundException("Custom field not found"));

        // Step 2: Upsert Logic.
        // We query it to see if a value record already exists for this intersection of Task and Field.
        // If it does, we update it. If it doesn't (.orElse), we instantiate a new row.
        TaskFieldValue fv = taskFieldValueRepository
                .findByTaskIdAndCustomFieldId(taskId, fieldId)
                .orElse(new TaskFieldValue(null, task, field, null));

        // Step 3: Set the new data payload and save.
        fv.setValue(value);
        taskFieldValueRepository.save(fv);
    }

    @Transactional(readOnly = true)
    public List<CustomFieldDTO.ValueDTO> getValuesForTask(Long taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        // Fetches the EAV intersection rows and flattens them into clean DTOs.
        return taskFieldValueRepository.findByTask(task).stream()
                .map(fv -> new CustomFieldDTO.ValueDTO(
                        fv.getCustomField().getId(),
                        fv.getCustomField().getName(),
                        fv.getCustomField().getFieldType(),
                        fv.getValue()))
                .collect(Collectors.toList());
    }

    // ── Internal Helpers & JSON Serialization ──

    private CustomFieldDTO toDTO(CustomField field) {
        List<String> options = Collections.emptyList();

        // Step 1: Deserialize the JSON string back into a List<String>.
        if (field.getOptions() != null && !field.getOptions().isBlank()) {
            try {
                options = objectMapper.readValue(field.getOptions(), new TypeReference<>() {});
            } catch (Exception ignored) {
                // If the JSON is somehow malformed in the DB, default to an empty list
                // so we don't bring down the whole UI rendering process.
            }
        }

        // Step 2: Build and return DTO.
        return new CustomFieldDTO(field.getId(), field.getProject().getId(),
                field.getName(), field.getFieldType(), options, field.getPosition());
    }

    private String toJson(List<String> list) {
        try { return objectMapper.writeValueAsString(list); } catch (Exception e) { return "[]"; }
    }
}
