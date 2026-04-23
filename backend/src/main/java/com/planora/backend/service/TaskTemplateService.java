package com.planora.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.TaskTemplateDTO;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskTemplate;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TaskTemplateRepository;
import com.planora.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TaskTemplateService {

    @Autowired private TaskTemplateRepository templateRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private UserRepository userRepository;

    // Jackson ObjectMapper used for serializing Java Lists into JSON strings for database storage.
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional(readOnly = true)
    public List<TaskTemplateDTO> getTemplates(Long projectId) {
        return templateRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    // Creates a new template from scratch based on user input.
    @Transactional
    public TaskTemplateDTO createTemplate(Long projectId, TaskTemplateDTO.CreateRequest req, Long userId) {
        // Step 1: Validate relationships.
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        User creator = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Step 2: Build the Template entity.
        TaskTemplate t = new TaskTemplate();

        // Metadata
        t.setProject(project);
        t.setCreatedBy(creator);
        t.setName(req.getName());

        // Default task values
        t.setTitle(req.getTitle());
        t.setDescription(req.getDescription());
        t.setPriority(req.getPriority());
        t.setStoryPoint(req.getStoryPoint());

        // Step 3: Serialize the List<Long> of Label IDs into a flat JSON string.
        if (req.getLabelIds() != null) t.setLabelIds(toJson(req.getLabelIds()));

        return toDTO(templateRepository.save(t));
    }

    /** Save an existing task as a template. */
    @Transactional
    public TaskTemplateDTO saveTaskAsTemplate(Long taskId, String templateName, Long userId) {

        // Step 1: Fetch the source task with all its details eagerly loaded to prevent N+1 queries.
        Task task = taskRepository.findByIdWithDetails(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        User creator = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Step 2: Build the new template.
        TaskTemplate t = new TaskTemplate();
        t.setProject(task.getProject());
        t.setCreatedBy(creator);

        // Step 3: Use the provided name or fallback to the task title + "(template)".
        t.setName(templateName != null ? templateName : task.getTitle() + " (template)");

        // Step 4: Copy the live task data.
        t.setTitle(task.getTitle());
        t.setDescription(task.getDescription());
        t.setPriority(task.getPriority() != null ? task.getPriority().name() : null);
        t.setStoryPoint(task.getStoryPoint());

        // Step 5: Extract the IDs from the Task's Label entities and serialize them to JSON.
        List<Long> ids = task.getLabels().stream().map(l -> l.getId()).collect(Collectors.toList());
        if (!ids.isEmpty()) t.setLabelIds(toJson(ids));

        return toDTO(templateRepository.save(t));
    }

    @Transactional
    public void deleteTemplate(Long templateId) {
        templateRepository.findById(templateId)
                .orElseThrow(() -> new ResourceNotFoundException("Template not found"));
        templateRepository.deleteById(templateId);
    }

    // ── Internal Helpers & JSON Serialization ──

    private TaskTemplateDTO toDTO(TaskTemplate t) {
        List<Long> lids = Collections.emptyList();

        // Step 1: Deserialize the JSON string back into a List<Long>.
        // Using a TypeReference ensures Java knows exactly what type of list to build.
        if (t.getLabelIds() != null && !t.getLabelIds().isBlank()) {
            try {
                lids = objectMapper.readValue(t.getLabelIds(), new TypeReference<>() {});
            }
            catch (Exception ignored) {
                // If deserialization fails (e.g., corrupt data), we silently fall back
                // to an empty list rather than crashing the entire GET request.
            }
        }

        String creatorName = t.getCreatedBy() != null ? t.getCreatedBy().getUsername() : null;

        // Step 2: Construct the DTO.
        return new TaskTemplateDTO(t.getId(), t.getProject().getId(),
                t.getName(), t.getTitle(), t.getDescription(), t.getPriority(),
                t.getStoryPoint(), lids, t.getCreatedAt(), creatorName);
    }

    private String toJson(List<?> list) {
        try { return objectMapper.writeValueAsString(list); } catch (Exception e) { return "[]"; }
    }
}
