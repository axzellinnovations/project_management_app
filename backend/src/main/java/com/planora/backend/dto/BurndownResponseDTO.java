package com.planora.backend.dto;

import java.util.List;

/**
 * Full burndown chart response for a sprint.
 */
public record BurndownResponseDTO(
        Long sprintId,
        String sprintName,
        String startDate,           // sprint actual start date "YYYY-MM-DD"
        String endDate,             // sprint actual end date "YYYY-MM-DD"
        int totalStoryPoints,       // sum of storyPoint across ALL tasks in sprint
        List<BurndownDataPointDTO> dataPoints
) {}
