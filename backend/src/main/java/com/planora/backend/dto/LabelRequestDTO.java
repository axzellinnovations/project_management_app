package com.planora.backend.dto;

import lombok.Data;

@Data
public class LabelRequestDTO {
    private Long projectId;
    private String name;
    private String color;
}
