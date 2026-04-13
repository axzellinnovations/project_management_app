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

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional(readOnly = true)
    public List<TaskTemplateDTO> getTemplates(Long projectId) {
        return templateRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public TaskTemplateDTO createTemplate(Long projectId, TaskTemplateDTO.CreateRequest req, Long userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        User creator = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        TaskTemplate t = new TaskTemplate();
        t.setProject(project);
        t.setCreatedBy(creator);
        t.setName(req.getName());
        t.setTitle(req.getTitle());
        t.setDescription(req.getDescription());
        t.setPriority(req.getPriority());
        t.setStoryPoint(req.getStoryPoint());
        if (req.getLabelIds() != null) t.setLabelIds(toJson(req.getLabelIds()));

        return toDTO(templateRepository.save(t));
    }

    /** Save an existing task as a template. */
    @Transactional
    public TaskTemplateDTO saveTaskAsTemplate(Long taskId, String templateName, Long userId) {
        Task task = taskRepository.findByIdWithDetails(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        User creator = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        TaskTemplate t = new TaskTemplate();
        t.setProject(task.getProject());
        t.setCreatedBy(creator);
        t.setName(templateName != null ? templateName : task.getTitle() + " (template)");
        t.setTitle(task.getTitle());
        t.setDescription(task.getDescription());
        t.setPriority(task.getPriority() != null ? task.getPriority().name() : null);
        t.setStoryPoint(task.getStoryPoint());
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

    private TaskTemplateDTO toDTO(TaskTemplate t) {
        List<Long> lids = Collections.emptyList();
        if (t.getLabelIds() != null && !t.getLabelIds().isBlank()) {
            try { lids = objectMapper.readValue(t.getLabelIds(), new TypeReference<>() {}); } catch (Exception ignored) {}
        }
        String creatorName = t.getCreatedBy() != null ? t.getCreatedBy().getUsername() : null;
        return new TaskTemplateDTO(t.getId(), t.getProject().getId(),
                t.getName(), t.getTitle(), t.getDescription(), t.getPriority(),
                t.getStoryPoint(), lids, t.getCreatedAt(), creatorName);
    }

    private String toJson(List<?> list) {
        try { return objectMapper.writeValueAsString(list); } catch (Exception e) { return "[]"; }
    }
}
