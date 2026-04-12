package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
public class KanbanBoardResponseDTO {
    private Long kanbanId;
    private String name;
    private Long projectId;
    private List<KanbanColumnDTO> columns;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class KanbanColumnDTO {
        private Long id;
        private String name;
        private String status; // maps to the status string used in tasks (e.g. "TODO")
        private Integer position;
        private String color;
        private Integer wipLimit;
    }
}
