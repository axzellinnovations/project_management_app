package com.planora.backend.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MilestoneResponseDTO {
    private Long id;
    private Long projectId;
    private String name;
    private String description;
    private LocalDate dueDate;
    private String status;
    private long taskCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
