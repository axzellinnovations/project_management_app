package com.planora.backend.dto;

import lombok.Data;

@Data
public class UpdateProjectDTO {
    private String name;
    private String description;
    private String type;
}