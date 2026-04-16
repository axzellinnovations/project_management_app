package com.planora.backend.service;

import com.planora.backend.model.Priority;
import com.planora.backend.model.Task;
import com.planora.backend.repository.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Spawns new task instances for recurring tasks whose nextOccurrence is today or past.
 * Runs once every day at midnight UTC.
 */
@Service
public class RecurringTaskScheduler {

    private static final Logger log = LoggerFactory.getLogger(RecurringTaskScheduler.class);

    @Autowired
    private TaskRepository taskRepository;

    @Scheduled(cron = "0 0 0 * * *")   // every day at midnight UTC
    @Transactional
    public void spawnDueRecurrences() {
        LocalDate today = LocalDate.now();
        List<Task> due = taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(today);

        for (Task template : due) {
            try {
                // Stop if recurrence has ended
                if (template.getRecurrenceEnd() != null && template.getRecurrenceEnd().isBefore(today)) {
                    template.setNextOccurrence(null);
                    taskRepository.save(template);
                    continue;
                }

                // Spawn a new task instance
                Task instance = new Task();
                instance.setTitle(template.getTitle());
                instance.setDescription(template.getDescription());
                instance.setProject(template.getProject());
                instance.setSprint(template.getSprint());
                instance.setKanbanColumn(template.getKanbanColumn());
                instance.setAssignee(template.getAssignee());
                instance.getAssignees().addAll(template.getAssignees());
                instance.setReporter(template.getReporter());
                instance.setPriority(template.getPriority());
                instance.setRecurrenceParent(template);
                LocalDate dueDate = template.getNextOccurrence();
                instance.setStartDate(dueDate);
                instance.setDueDate(dueDate);

                if (template.getMilestone() != null) {
                    instance.setMilestone(template.getMilestone());
                }

                taskRepository.save(instance);

                // Advance the template's nextOccurrence
                LocalDate next = advance(template.getNextOccurrence(), template.getRecurrenceRule());
                if (template.getRecurrenceEnd() != null && next.isAfter(template.getRecurrenceEnd())) {
                    next = null;  // no more occurrences
                }
                template.setNextOccurrence(next);
                taskRepository.save(template);

                log.info("Spawned recurring task instance for template={} on {}", template.getId(), dueDate);
            } catch (Exception e) {
                log.error("Failed to spawn recurrence for task {}: {}", template.getId(), e.getMessage());
            }
        }
    }

    private LocalDate advance(LocalDate from, String rule) {
        if (from == null || rule == null) return from;
        return switch (rule.toUpperCase()) {
            case "DAILY"   -> from.plusDays(1);
            case "WEEKLY"  -> from.plusWeeks(1);
            case "MONTHLY" -> from.plusMonths(1);
            case "YEARLY"  -> from.plusYears(1);
            default        -> from;
        };
    }
}
