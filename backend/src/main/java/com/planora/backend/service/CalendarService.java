package com.planora.backend.service;

import com.planora.backend.dto.CalendarEventDTO;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.Task;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Combines Task and Sprint data for the calendar view.
 * No new database tables – reuses existing repositories.
 */
@Service
public class CalendarService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private SprintRepository sprintRepository;

    /**
     * Returns all calendar events (tasks + sprints) for a given project.
     *
     * @param projectId the project whose items should be returned
     * @return list of CalendarEventDTOs ready for the frontend
     */
    public List<CalendarEventDTO> getCalendarEvents(Long projectId) {
        List<CalendarEventDTO> events = new ArrayList<>();

        // --- TASKS ---
        List<Task> tasks = taskRepository.findByProjectId(projectId);
        for (Task task : tasks) {
            // Only include tasks that have at least a due date or a start date
            if (task.getDueDate() == null && task.getStartDate() == null) {
                continue;
            }

            CalendarEventDTO event = new CalendarEventDTO();
            event.setId("task-" + task.getId());
            event.setTitle(task.getTitle());
            event.setDescription(task.getDescription());
            event.setKind("task");
            event.setType(task.getStatus() != null ? "Task" : "Task"); // extend later if you add a task-type field
            event.setStatus(task.getStatus());
            event.setStartDate(task.getStartDate());
            event.setEndDate(task.getDueDate());   // tasks: end = dueDate
            event.setDueDate(task.getDueDate());
            event.setHasComment(!task.getComments().isEmpty());

            // Assignee full name (assignee is loaded EAGER on Task)
            if (task.getAssignee() != null && task.getAssignee().getUser() != null) {
                event.setAssignee(task.getAssignee().getUser().getFullName());
            }

            // Reporter full name
            if (task.getReporter() != null && task.getReporter().getUser() != null) {
                event.setCreator(task.getReporter().getUser().getFullName());
            }

            events.add(event);
        }

        // --- SPRINTS ---
        List<Sprint> sprints = sprintRepository.findByProId(projectId);
        for (Sprint sprint : sprints) {
            CalendarEventDTO event = new CalendarEventDTO();
            event.setId("sprint-" + sprint.getId());
            event.setTitle(sprint.getName());
            event.setKind("sprint");
            event.setType("Sprint");
            event.setStatus(sprint.getStatus() != null ? sprint.getStatus().name() : null);
            event.setStartDate(sprint.getStartDate());
            event.setEndDate(sprint.getEndDate());
            event.setDueDate(sprint.getEndDate());

            events.add(event);
        }

        return events;
    }
}
