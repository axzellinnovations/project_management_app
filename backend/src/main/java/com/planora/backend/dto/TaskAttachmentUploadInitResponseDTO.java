package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskAttachmentUploadInitResponseDTO {
    private String uploadUrl;
    private String objectKey;
    private long expiresInSeconds;
}
