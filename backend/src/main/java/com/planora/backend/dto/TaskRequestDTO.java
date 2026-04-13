package com.planora.backend.dto;

import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TaskRequestDTO {

    public interface OnCreate {}

    @NotBlank(message = "Task title is required", groups = OnCreate.class)
    @Size(max = 500, message = "Task title must not exceed 500 characters")
    private String title;

    private String description;

    @Pattern(regexp = "^(LOW|MEDIUM|HIGH|URGENT)$",
             message = "Priority must be LOW, MEDIUM, HIGH, or URGENT")
    private String priority;

    @Pattern(regexp = "^[A-Z0-9_]{1,50}$",
             message = "Status must contain only uppercase letters, digits, or underscores (max 50 chars)")
    private String status;

    @Min(value = 0, message = "Story points must be at least 0")
    @Max(value = 999, message = "Story points must not exceed 999")
    private Integer storyPoint;

    private LocalDate dueDate;
    private LocalDate startDate;

    private Long projectId;

    private Long assigneeId;
    private Long reporterId;

    private List<Long> assigneeIds;   // multiple assignees (V4)

    private Long sprintId;
    private Long KanbanColumnId;

    private Long parentId;

    private List<Long> labelIds;

    private Long milestoneId;

    // Recurring task fields (V7)
    private String recurrenceRule;    // DAILY | WEEKLY | MONTHLY | YEARLY
    private java.time.LocalDate recurrenceEnd;
}
