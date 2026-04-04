package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class DashboardBoardDTO {
    private Long id; // Sprintboard ID
    private String name; // Sprint Name mapping directly to Sprintboard
    private Long projectId;
    private String projectName;
    private LocalDateTime updatedAt;
}
