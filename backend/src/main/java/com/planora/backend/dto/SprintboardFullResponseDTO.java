package com.planora.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SprintboardFullResponseDTO {
    private Long id;
    private Long sprintId;
    private String sprintName;
    private String sprintStatus;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private SprintboardStatsDTO stats;
    private List<SprintcolumnFullDTO> columns;
}
