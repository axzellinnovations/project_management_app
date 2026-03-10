package com.planora.backend.dto;

import com.planora.backend.model.ProjectType;
import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.antlr.v4.runtime.misc.NotNull;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectDTO {

    @NotBlank(message = "Project name is required")
    private String name;

    private String description;

    @NotNull
    private ProjectType type;

    @NotBlank(message = "Project key is required")
    private String projectKey;

    private Long ownerId;

    private String teamOption; // "EXISTING" or "NEW"

    private String teamName; // Required if teamOption is "NEW"

    private Long teamId;
}