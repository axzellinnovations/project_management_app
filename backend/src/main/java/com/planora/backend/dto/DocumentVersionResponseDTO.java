package com.planora.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class DocumentVersionResponseDTO {
    private Long id;
    private Integer versionNumber;
    private String contentType;
    private Long fileSize;
    private Long uploadedById;
    private String uploadedByName;
    private LocalDateTime uploadedAt;
    private String downloadUrl;
}
