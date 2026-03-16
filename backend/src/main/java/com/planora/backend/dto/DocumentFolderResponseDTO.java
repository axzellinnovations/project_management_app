package com.planora.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class DocumentFolderResponseDTO {
    private Long id;
    private String name;
    private Long projectId;
    private Long parentFolderId;
    private Long createdById;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
