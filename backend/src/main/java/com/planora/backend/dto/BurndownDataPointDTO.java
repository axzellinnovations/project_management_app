package com.planora.backend.dto;

/**
 * Represents a single data point on the burndown chart for one day of the sprint.
 */
public record BurndownDataPointDTO(
        String date,           // "YYYY-MM-DD"
        int remainingPoints,   // actual remaining story points on this day
        int idealPoints        // ideal remaining story points on this day
) {}
