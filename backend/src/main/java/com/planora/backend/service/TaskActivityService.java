package com.planora.backend.service;

import com.planora.backend.dto.TaskActivityResponseDTO;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskActivity;
import com.planora.backend.model.TaskActivityType;
import com.planora.backend.repository.TaskActivityRepository;
import com.planora.backend.repository.TaskRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskActivityService {

    private final TaskActivityRepository taskActivityRepository;
    private final TaskRepository taskRepository;

    @Transactional
    public void logActivity(Long taskId, TaskActivityType type, String actorName, String description) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found"));
        TaskActivity activity = new TaskActivity();
        activity.setTask(task);
        activity.setActivityType(type);
        activity.setActorName(actorName != null ? actorName : "System");
        activity.setDescription(description);
        taskActivityRepository.save(activity);
    }

    @Transactional(readOnly = true)
    public List<TaskActivityResponseDTO> getActivities(Long taskId) {
        return taskActivityRepository.findByTaskIdOrderByCreatedAtDesc(taskId).stream()
                .map(a -> TaskActivityResponseDTO.builder()
                        .id(a.getId())
                        .activityType(a.getActivityType().name())
                        .actorName(a.getActorName())
                        .description(a.getDescription())
                        .createdAt(a.getCreatedAt().toString())
                        .build())
                .collect(Collectors.toList());
    }
}
