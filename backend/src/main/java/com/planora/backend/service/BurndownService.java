package com.planora.backend.service;

import com.planora.backend.dto.BurndownDataPointDTO;
import com.planora.backend.dto.BurndownResponseDTO;
import com.planora.backend.dto.SprintResponseDTO;
import com.planora.backend.dto.SprintVelocityDTO;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.Task;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class BurndownService {

    private final SprintRepository sprintRepository;
    private final TaskRepository taskRepository;
    private final SprintService sprintService;

    public BurndownService(SprintRepository sprintRepository,
                           TaskRepository taskRepository,
                           SprintService sprintService) {
        this.sprintRepository = sprintRepository;
        this.taskRepository = taskRepository;
        this.sprintService = sprintService;
    }

    /**
     * Builds a burndown chart response for the given sprint.
     * Optionally filters the visible date range with {@code from}/{@code to}.
     *
     * @param sprintId        ID of the sprint
     * @param fromDate        optional start of visible range (defaults to sprint startDate)
     * @param toDate          optional end of visible range (defaults to sprint endDate or today)
     * @param currentUserId   ID of the requesting user (used for membership check)
     */
    @Transactional(readOnly = true)
    public BurndownResponseDTO getBurndownData(Long sprintId,
                                               LocalDate fromDate,
                                               LocalDate toDate,
                                               Long currentUserId) {

        // Authorisation re-used from SprintService (throws if not a member)
        Sprint sprint = sprintService.getSprintEntityById(sprintId);

        LocalDate sprintStart = sprint.getStartDate();
        LocalDate sprintEnd   = sprint.getEndDate() != null ? sprint.getEndDate()
                                                             : LocalDate.now();

        // Clamp the visible range to the sprint bounds
        LocalDate rangeStart = (fromDate != null && !fromDate.isBefore(sprintStart))
                ? fromDate : sprintStart;
        LocalDate rangeEnd   = (toDate   != null && !toDate.isAfter(sprintEnd))
                ? toDate : sprintEnd;

        if (rangeStart.isAfter(rangeEnd)) {
            rangeStart = sprintStart;
            rangeEnd   = sprintEnd;
        }

        // Fetch tasks
        List<Task> allTasks  = taskRepository.findBySprintId(sprintId);
        List<Task> doneTasks = allTasks.stream()
                .filter(t -> "done".equalsIgnoreCase(t.getStatus()))
                .collect(Collectors.toList());

        // Total story points (all tasks in sprint)
        int total = allTasks.stream().mapToInt(Task::getStoryPoint).sum();

        long totalDays = java.time.temporal.ChronoUnit.DAYS.between(sprintStart, sprintEnd);

        List<BurndownDataPointDTO> points = new ArrayList<>();
        DateTimeFormatter fmt = DateTimeFormatter.ISO_LOCAL_DATE;

        LocalDate current = rangeStart;
        while (!current.isAfter(rangeEnd)) {
            // Ideal: linearly decreasing from total → 0 over the full sprint duration
            int ideal;
            if (totalDays == 0) {
                ideal = 0;
            } else {
                long dayIdx = java.time.temporal.ChronoUnit.DAYS.between(sprintStart, current);
                ideal = (int) Math.round(total * (1.0 - (double) dayIdx / (double) totalDays));
                ideal = Math.max(0, ideal);
            }

            // Actual: total − story points of tasks completed ON OR BEFORE this day
            final LocalDate day = current;
            int completedPoints = doneTasks.stream()
                    .filter(t -> {
                        LocalDateTime completedAt = t.getCompletedAt();
                        if (completedAt == null) {
                            // If DONE but no completedAt, treat as completed today
                            return !LocalDate.now().isAfter(day);
                        }
                        return !completedAt.toLocalDate().isAfter(day);
                    })
                    .mapToInt(Task::getStoryPoint)
                    .sum();

            int remaining = Math.max(0, total - completedPoints);

            points.add(new BurndownDataPointDTO(current.format(fmt), remaining, ideal));
            current = current.plusDays(1);
        }

        return new BurndownResponseDTO(
                sprint.getId(),
                sprint.getName(),
                sprintStart.format(fmt),
                sprintEnd.format(fmt),
                total,
                points
        );
    }

    /**
     * Returns velocity data (committed vs completed story points) for every
     * COMPLETED sprint in the given project. Uses SprintService for the
     * membership auth check.
     *
     * @param projectId     ID of the project
     * @param currentUserId ID of the requesting user
     */
    @Transactional(readOnly = true)
    public List<SprintVelocityDTO> getVelocityData(Long projectId, Long currentUserId) {
        List<SprintResponseDTO> sprints = sprintService.getSprintsByProject(projectId, currentUserId);

        return sprints.stream()
                .filter(s -> "COMPLETED".equals(s.getStatus()))
                .map(s -> {
                    List<Task> tasks = taskRepository.findBySprintId(s.getId());
                    int committed = tasks.stream().mapToInt(Task::getStoryPoint).sum();
                    int completed = tasks.stream()
                            .filter(t -> "DONE".equalsIgnoreCase(t.getStatus()))
                            .mapToInt(Task::getStoryPoint)
                            .sum();
                    return new SprintVelocityDTO(s.getId(), s.getName(), committed, completed);
                })
                .collect(Collectors.toList());
    }
}
