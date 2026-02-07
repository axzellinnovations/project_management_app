package com.planora.backend.dto;

import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class TaskRequestDTO {
    private String title;
    private String description;

    private String priority;
    private String status;

    private int storyPoint;

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
