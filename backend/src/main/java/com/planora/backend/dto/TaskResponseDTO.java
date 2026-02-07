package com.planora.backend.dto;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class TaskResponseDTO {
    private Long id;
    private String title;
    private String description;
    private String priority;
    private String status;
    private int storyPoint;
    private LocalDate startDate;
    private LocalDate dueDate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private Long projectId;
    private String projectName;

    private Long assigneeId;
    private String assigneeName;

    private Long sprintId;
    private String sprintName;

    private Long reporterId;
    private String reporterName;
}
