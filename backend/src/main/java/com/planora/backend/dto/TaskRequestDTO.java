package com.planora.backend.dto;

import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
public class TaskRequestDTO {

    @NotBlank(message = "Task title is required")
    @Size(max = 500, message = "Task title must not exceed 500 characters")
    private String title;

    private String description;

    @Pattern(regexp = "^(LOW|MEDIUM|HIGH|URGENT)$",
             message = "Priority must be LOW, MEDIUM, HIGH, or URGENT")
    private String priority;

    @Pattern(regexp = "^(TODO|IN_PROGRESS|IN_REVIEW|DONE)$",
             message = "Status must be TODO, IN_PROGRESS, IN_REVIEW, or DONE")
    private String status;

    @Min(value = 0, message = "Story points must be at least 0")
    @Max(value = 999, message = "Story points must not exceed 999")
    private Integer storyPoint;

    private LocalDate dueDate;
    private LocalDate startDate;

    private Long projectId;

    private Long assigneeId;
    private Long reporterId;

    private Long sprintId;
    private Long KanbanColumnId;

    private Long parentId;

    private List<Long> labelIds;
}
