package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GlobalSearchResponseDTO {
    private List<TaskSearchResultDTO> tasks;
    private List<DocumentSearchResultDTO> documents;
    private List<MemberSearchResultDTO> members;
    private List<ProjectSearchResultDTO> projects;

    public enum SearchResultType {
        TASK,
        DOCUMENT,
        MEMBER,
        PROJECT
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TaskSearchResultDTO {
        private Long id;
        private String title;
        private String subtitle;
        private String projectName;
        private String status;
        private String url;
        private SearchResultType type;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DocumentSearchResultDTO {
        private Long id;
        private String title;
        private String subtitle;
        private String url;
        private SearchResultType type;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MemberSearchResultDTO {
        private Long id;
        private String name;
        private String subtitle;
        private String url;
        private SearchResultType type;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ProjectSearchResultDTO {
        private Long id;
        private String title;
        private String subtitle;
        private String url;
        private SearchResultType type;
    }
}
