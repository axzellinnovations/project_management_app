package com.planora.backend.service;

import com.planora.backend.dto.CalendarEventDTO;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.model.Project;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.Task;
import com.planora.backend.model.TeamMember;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Combines Task and Sprint data for the calendar view.
 * No new database tables – reuses existing repositories.
 */
@Service
public class CalendarService {

    private final TaskRepository taskRepository;
    private final SprintRepository sprintRepository;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;

    public CalendarService(TaskRepository taskRepository,
                           SprintRepository sprintRepository,
                           ProjectRepository projectRepository,
                           TeamMemberRepository teamMemberRepository) {
        this.taskRepository = taskRepository;
        this.sprintRepository = sprintRepository;
        this.projectRepository = projectRepository;
        this.teamMemberRepository = teamMemberRepository;
    }

    /**
     * Returns all calendar events (tasks + sprints) for a given project.
     *
     * @param projectId     the project whose items should be returned
     * @param currentUserId the requesting user (membership check)
     * @return list of CalendarEventDTOs ready for the frontend
     */
    @Transactional(readOnly = true)
    public List<CalendarEventDTO> getCalendarEvents(Long projectId, Long currentUserId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        Long teamId = project.getTeam().getId();
        TeamMember member = teamMemberRepository.findByTeamIdAndUserUserId(teamId, currentUserId)
                .orElseThrow(() -> new ForbiddenException("Access denied: Not a team member"));

        List<CalendarEventDTO> events = new ArrayList<>();

        // --- TASKS --- (use WithScalars to eagerly load assignee.user / reporter.user)
        List<Task> tasks = taskRepository.findByProjectIdWithScalars(projectId);
        for (Task task : tasks) {
            if (task.getDueDate() == null && task.getStartDate() == null) {
                continue;
            }

            CalendarEventDTO event = new CalendarEventDTO();
            event.setId("task-" + task.getId());
            event.setTitle(task.getTitle());
            event.setDescription(task.getDescription());
            event.setKind("task");
            event.setType("Task");
            event.setStatus(task.getStatus());
            event.setStartDate(task.getStartDate());
            event.setEndDate(task.getDueDate());
            event.setDueDate(task.getDueDate());
            // Avoid lazy-loading comments/attachments collections - not critical for calendar view
            event.setHasComment(false);
            event.setHasAttachment(false);

            if (task.getAssignee() != null && task.getAssignee().getUser() != null) {
                event.setAssignee(task.getAssignee().getUser().getFullName());
            }
            if (task.getReporter() != null && task.getReporter().getUser() != null) {
                event.setCreator(task.getReporter().getUser().getFullName());
            }

            events.add(event);
        }

        // --- SPRINTS ---
        List<Sprint> sprints = sprintRepository.findByProject_Id(projectId);
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
