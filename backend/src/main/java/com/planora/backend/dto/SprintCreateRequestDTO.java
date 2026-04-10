package com.planora.backend.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/** Request body for POST /api/sprints and PUT /api/sprints/{id} */
@Data
@NoArgsConstructor
public class SprintCreateRequestDTO {
    private Long proId;
    private String name;
    private LocalDate startDate;
    private LocalDate endDate;
    private String status;
    private String goal;
}
