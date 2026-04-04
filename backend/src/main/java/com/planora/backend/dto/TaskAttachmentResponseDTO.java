package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskAttachmentResponseDTO {
    private Long id;
    private String fileName;
    private String contentType;
    private Long fileSize;
    private String downloadUrl;
    private String uploadedByName;
    private LocalDateTime createdAt;
}
