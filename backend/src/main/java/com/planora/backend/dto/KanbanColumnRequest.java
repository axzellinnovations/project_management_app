package com.planora.backend.dto;

import lombok.Data;

@Data
public class KanbanColumnRequest {
    private String name;
    private int position;
    private Long boardId;

}
