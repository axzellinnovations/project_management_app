package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class SprintboardStatsDTO {
    private long totalTasks;
    private long doneTasks;
    private long totalStoryPoints;
    private long doneStoryPoints;
    private long overdueTasks;
    private long unassignedTasks;
}
