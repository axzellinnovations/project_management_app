package com.planora.backend.dto;

import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
public class TaskRequestDTO {
    private String title;
    private String description;

    private String priority;
    private String status;

    private Integer storyPoint;

    private LocalDate dueDate;
    private LocalDate startDate;

    private Long projectId;

    private Long assigneeId;
    private Long reporterId;

    private Long sprintId;
    private Long KanbanColumnId;

    private Long parentId;

    private List<Long> labelIds;
}
