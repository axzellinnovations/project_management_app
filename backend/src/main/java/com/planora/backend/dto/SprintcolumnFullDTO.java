package com.planora.backend.dto;

import java.util.List;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SprintcolumnFullDTO {
    private Long id;
    private Integer position;
    private String columnName;
    private String columnStatus;
    private List<SprintboardTaskResponseDTO> tasks;
}
