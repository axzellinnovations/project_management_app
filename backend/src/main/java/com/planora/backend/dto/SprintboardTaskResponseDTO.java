package com.planora.backend.dto;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class SprintboardTaskResponseDTO {
    private Long taskId;
    private Long projectTaskNumber;
    private String title;
    private Integer storyPoint;
    private String assigneeName;
    private String assigneePhotoUrl;
    private String status;
    private String priority;
    private LocalDate dueDate;
    private LocalDateTime updatedAt;
    private Integer attachmentCount;
    private Integer commentCount;
    private String labelName;
    private String labelColor;
}