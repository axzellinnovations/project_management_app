package com.planora.backend.dto;

import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CustomFieldDTO {
    private Long id;
    private Long projectId;
    private String name;
    private String fieldType;      // TEXT | NUMBER | DATE | SELECT
    private List<String> options;  // only for SELECT
    private int position;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ValueDTO {
        private Long customFieldId;
        private String fieldName;
        private String fieldType;
        private String value;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpsertRequest {
        private String name;
        private String fieldType;
        private List<String> options;
        private int position;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SetValueRequest {
        private String value;
    }
}
