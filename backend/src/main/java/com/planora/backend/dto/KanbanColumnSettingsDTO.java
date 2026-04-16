package com.planora.backend.dto;

import lombok.Data;

@Data
public class KanbanColumnSettingsDTO {
    private String color;     // nullable
    private Integer wipLimit; // nullable
}
