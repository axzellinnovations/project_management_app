package com.planora.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DocumentUploadInitResponseDTO {
    private String uploadUrl;
    private String objectKey;
    private long expiresInSeconds;
}
