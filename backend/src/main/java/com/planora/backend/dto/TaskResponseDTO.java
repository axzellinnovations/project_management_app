package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class TaskResponseDTO {
    private Long id;
    private Long projectTaskNumber;
    private String title;
    private String description;
    private String priority;
    private String status;
    private int storyPoint;
    private LocalDate startDate;
    private LocalDate dueDate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private Long projectId;
    private String projectName;

    private Long assigneeId;
    private String assigneeName;
    private String assigneePhotoUrl;

    private List<AssigneeDTO> assignees;   // multiple assignees (V4)

    private Long sprintId;
    private String sprintName;

    private Long reporterId;
    private String reporterName;

    private Long milestoneId;
    private String milestoneName;

    private List<SubtaskDTO> subtasks;
    private List<LabelDTO> labels;
    private List<DependencyDTO> dependencies;
    private List<AttachmentDTO> attachments;

    // Recurring task fields (V7)
    private String recurrenceRule;
    private java.time.LocalDate recurrenceEnd;
    private Long recurrenceParentId;
    private java.time.LocalDate nextOccurrence;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class AssigneeDTO {
        private Long memberId;
        private Long userId;
        private String name;
        private String photoUrl;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class SubtaskDTO {
        private Long id;
        private String title;
        private String status;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class LabelDTO {
        private Long id;
        private String name;
        private String color;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class DependencyDTO {
        private Long id;
        private String title;
        private String relation;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class AttachmentDTO {
        private Long id;
        private String fileName;
        private String contentType;
        private Long fileSize;
        private String uploadedByName;
    }
}
