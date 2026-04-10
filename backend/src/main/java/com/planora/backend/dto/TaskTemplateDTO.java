package com.planora.backend.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskTemplateDTO {
    private Long id;
    private Long projectId;
    private String name;
    private String title;
    private String description;
    private String priority;
    private int storyPoint;
    private List<Long> labelIds;
    private LocalDateTime createdAt;
    private String createdByName;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateRequest {
        private String name;        // template name
        private String title;
        private String description;
        private String priority;
        private int storyPoint;
        private List<Long> labelIds;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SaveFromTaskRequest {
        private String templateName;  // name to save under
    }
}
