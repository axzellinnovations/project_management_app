package com.planora.backend.service;

import com.planora.backend.model.Task;
import com.planora.backend.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecurringTaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private RecurringTaskScheduler recurringTaskScheduler;

    private Task templateTask;

    @BeforeEach
    void setUp() {
        templateTask = new Task();
        templateTask.setId(1L);
        templateTask.setTitle("Daily standup");
        templateTask.setNextOccurrence(LocalDate.now().minusDays(1));
        templateTask.setRecurrenceRule("DAILY");
    }

    @Test
    void spawnDueRecurrences_doesNothingWhenNoTasksDue() {
        when(taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(any()))
                .thenReturn(List.of());

        recurringTaskScheduler.spawnDueRecurrences();

        verify(taskRepository, never()).save(any());
    }

    @Test
    void spawnDueRecurrences_spawnsNewTaskInstance() {
        when(taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(any()))
                .thenReturn(List.of(templateTask));
        when(taskRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        recurringTaskScheduler.spawnDueRecurrences();

        // Saved at least twice: once for the spawned instance, once to update template
        verify(taskRepository, atLeast(2)).save(any(Task.class));
    }

    @Test
    void spawnDueRecurrences_advancesNextOccurrenceByOneDay_forDailyRule() {
        LocalDate today = LocalDate.now();
        templateTask.setNextOccurrence(today.minusDays(1));
        templateTask.setRecurrenceRule("DAILY");

        when(taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(any()))
                .thenReturn(List.of(templateTask));
        when(taskRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        recurringTaskScheduler.spawnDueRecurrences();

        // Template's nextOccurrence should advance by 1 day
        assertEquals(today, templateTask.getNextOccurrence());
    }

    @Test
    void spawnDueRecurrences_clearsNextOccurrence_whenRecurrenceEndPassed() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        templateTask.setNextOccurrence(yesterday);
        templateTask.setRecurrenceEnd(yesterday); // end is also in the past

        when(taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(any()))
                .thenReturn(List.of(templateTask));
        when(taskRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        recurringTaskScheduler.spawnDueRecurrences();

        // Because recurrenceEnd < today, no new instance spawned; nextOccurrence nulled out
        assertNull(templateTask.getNextOccurrence());
    }

    @Test
    void spawnDueRecurrences_continuesOnException() {
        Task badTask = new Task();
        badTask.setId(2L);
        badTask.setNextOccurrence(LocalDate.now().minusDays(1));
        badTask.setRecurrenceRule("DAILY");
        // getAssignees() will throw NPE since assignees list is not initialized in this minimal mock

        when(taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(any()))
                .thenReturn(List.of(badTask));
        when(taskRepository.save(any())).thenThrow(new RuntimeException("DB error"));

        // Should not propagate exception
        assertDoesNotThrow(() -> recurringTaskScheduler.spawnDueRecurrences());
    }
}
