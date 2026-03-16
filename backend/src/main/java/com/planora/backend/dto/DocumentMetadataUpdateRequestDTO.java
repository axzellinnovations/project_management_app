package com.planora.backend.dto;

import lombok.Data;

@Data
public class DocumentMetadataUpdateRequestDTO {
    private String name;
    private Long folderId;
}
