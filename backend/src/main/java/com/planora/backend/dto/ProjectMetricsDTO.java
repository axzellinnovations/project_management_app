package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectMetricsDTO {
    private Long totalTasks;
    private Long completedTasks;
    private Long overdueTasks;
    private Long memberCount;
    private Integer sprintHealth;
    private Long activeSprintId;
}
