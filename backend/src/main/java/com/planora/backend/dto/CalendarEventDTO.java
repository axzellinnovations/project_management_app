package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Returned by GET /api/calendar/events?projectId=...
 * One entry for each Task or Sprint belonging to the project.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class CalendarEventDTO {

    /** "task-{id}" or "sprint-{id}" – matches the format the frontend expects */
    private String id;

    private String title;
    private String description;

    /** "task" or "sprint" */
    private String kind;

    /** Task type value (Bug, Story …) or "Sprint" */
    private String type;

    /** Task/Sprint status as a plain string */
    private String status;

    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDate dueDate;

    /** Full name of the assignee (tasks only) */
    private String assignee;

    /** Full name of the reporter / sprint creator */
    private String creator;

    /** Whether the task has at least one comment */
    private boolean hasComment;

    /** Whether the task has at least one attachment */
    private boolean hasAttachment;

    /** Environment label (e.g. "production", "staging") */
    private String environment;
}
