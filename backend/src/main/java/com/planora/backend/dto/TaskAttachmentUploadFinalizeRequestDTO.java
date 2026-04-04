package com.planora.backend.dto;

import lombok.Data;

@Data
public class TaskAttachmentUploadFinalizeRequestDTO {
    private String fileName;
    private String contentType;
    private Long fileSize;
    private String objectKey;
}
