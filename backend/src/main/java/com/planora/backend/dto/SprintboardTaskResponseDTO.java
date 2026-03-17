package com.planora.backend.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class SprintboardTaskResponseDTO {
    private Long taskId;
    private String title;
    private Integer storyPoint;
    private String assigneeName;
    private String status;
    private String priority;
    private LocalDate dueDate;
}