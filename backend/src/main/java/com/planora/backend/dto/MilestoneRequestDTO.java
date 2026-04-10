package com.planora.backend.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MilestoneRequestDTO {
    private String name;
    private String description;
    private LocalDate dueDate;
    private String status;
}
