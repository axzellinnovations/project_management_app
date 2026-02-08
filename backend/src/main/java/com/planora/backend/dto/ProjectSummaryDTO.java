package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ProjectSummaryDTO {
    private Long id;
    private String name;
    private String description;
    private LocalDateTime createdAt;
}
