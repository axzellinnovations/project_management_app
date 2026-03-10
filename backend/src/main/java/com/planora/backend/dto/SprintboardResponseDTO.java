package com.planora.backend.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class SprintboardResponseDTO {
    private Long id;
    private Long sprintId;
    private String sprintName;
    private String sprintStatus;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<SprintcolumnDTO> columns;
}