package com.planora.backend.dto;


import lombok.Data;

@Data
public class KanbanColumnRequestDTO {

    private String name;
    private Integer position;
    private Long kanbanId;
}