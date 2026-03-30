package com.planora.backend.dto;

import com.planora.backend.model.DocumentStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class DocumentResponseDTO {
    private Long id;
    private String name;
    private String contentType;
    private Long fileSize;
    private DocumentStatus status;
    private Long projectId;
    private Long folderId;
    private Integer latestVersionNumber;
    private String downloadUrl;
    private Long uploadedById;
    private String uploadedByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
}
