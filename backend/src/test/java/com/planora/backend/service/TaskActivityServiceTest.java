package com.planora.backend.service;

import com.planora.backend.dto.TaskActivityResponseDTO;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskActivity;
import com.planora.backend.model.TaskActivityType;
import com.planora.backend.repository.TaskActivityRepository;
import com.planora.backend.repository.TaskRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskActivityServiceTest {

    @Mock
    private TaskActivityRepository taskActivityRepository;

    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private TaskActivityService taskActivityService;

    private Task sampleTask;
    private TaskActivity sampleActivity;

    @BeforeEach
    void setUp() {
        sampleTask = new Task();
        sampleTask.setId(1L);
        sampleTask.setTitle("Fix login bug");

        sampleActivity = new TaskActivity();
        sampleActivity.setId(1L);
        sampleActivity.setTask(sampleTask);
        sampleActivity.setActivityType(TaskActivityType.TASK_CREATED);
        sampleActivity.setActorName("alice");
        sampleActivity.setDescription("Task created");
        sampleActivity.setCreatedAt(LocalDateTime.now());
    }

    @Test
    void logActivity_savesActivityForExistingTask() {
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));
        when(taskActivityRepository.save(any())).thenReturn(sampleActivity);

        assertDoesNotThrow(() ->
                taskActivityService.logActivity(1L, TaskActivityType.TASK_CREATED, "alice", "Task created"));

        verify(taskActivityRepository).save(any(TaskActivity.class));
    }

    @Test
    void logActivity_throwsEntityNotFoundException_whenTaskNotFound() {
        when(taskRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () ->
                taskActivityService.logActivity(99L, TaskActivityType.TASK_CREATED, "alice", "Task created"));
    }

    @Test
    void logActivity_usesSystemAsActorName_whenActorNameIsNull() {
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));
        when(taskActivityRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        taskActivityService.logActivity(1L, TaskActivityType.STATUS_CHANGED, null, "Status changed");

        verify(taskActivityRepository).save(argThat(a ->
                "System".equals(((TaskActivity) a).getActorName())));
    }

    @Test
    void getActivities_returnsListOfActivityDTOs() {
        when(taskActivityRepository.findByTaskIdOrderByCreatedAtDesc(1L))
                .thenReturn(List.of(sampleActivity));

        List<TaskActivityResponseDTO> result = taskActivityService.getActivities(1L);

        assertEquals(1, result.size());
        assertEquals("TASK_CREATED", result.get(0).getActivityType());
        assertEquals("alice", result.get(0).getActorName());
        assertEquals("Task created", result.get(0).getDescription());
    }

    @Test
    void getActivities_returnsEmptyList_whenNoActivities() {
        when(taskActivityRepository.findByTaskIdOrderByCreatedAtDesc(99L)).thenReturn(List.of());

        List<TaskActivityResponseDTO> result = taskActivityService.getActivities(99L);

        assertTrue(result.isEmpty());
    }
}
