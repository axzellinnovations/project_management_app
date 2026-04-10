package com.planora.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TaskActivityResponseDTO {
    private Long id;
    private String activityType;
    private String actorName;
    private String description;
    private String createdAt;
}
