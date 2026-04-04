package com.planora.backend.dto;

import lombok.Data;

@Data
public class TaskAttachmentUploadInitRequestDTO {
    private String fileName;
    private String contentType;
    private Long fileSize;
}
