package com.planora.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class DocumentUploadFinalizeRequestDTO {

    @NotBlank(message = "fileName is required")
    private String fileName;

    @NotBlank(message = "contentType is required")
    private String contentType;

    @NotNull(message = "fileSize is required")
    @Min(value = 1, message = "fileSize must be > 0")
    @Max(value = 26214400, message = "Maximum file size is 25MB")
    private Long fileSize;

    @NotBlank(message = "objectKey is required")
    private String objectKey;

    private Long folderId;
}
