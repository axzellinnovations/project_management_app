package com.planora.backend.dto;

import com.planora.backend.model.ProjectType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectDTO {

    @NotBlank(message = "Project name is required")
    @Size(max = 100, message = "Project name must be 100 characters or less")
    private String name;

    private String description;

    @NotNull(message = "Project type is required")
    private ProjectType type;

    @NotBlank(message = "Project key is required")
    @Pattern(regexp = "^[A-Z0-9-]{2,10}$", message = "Project key must be 2-10 uppercase letters/numbers")
    private String projectKey;

    private Long ownerId;

    private String teamOption; // "EXISTING" or "NEW"

    private String teamName; // Required if teamOption is "NEW"

    private Long teamId;
}