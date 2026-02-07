package com.planora.backend.dto;

import java.time.LocalDate;

public record StartSprintRequest(
        LocalDate startDate,
        LocalDate endDate
) {}
