package com.planora.backend.dto;

import lombok.Data;

@Data
public class SprintcolumnDTO {
    private Long id;
    private Integer position;
    private String columnName;
    private String columnStatus;
}