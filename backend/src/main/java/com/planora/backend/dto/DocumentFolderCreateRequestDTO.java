package com.planora.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DocumentFolderCreateRequestDTO {

    @NotBlank(message = "name is required")
    private String name;

    private Long parentFolderId;
}
