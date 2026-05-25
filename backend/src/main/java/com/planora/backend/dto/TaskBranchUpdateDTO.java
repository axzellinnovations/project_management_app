package com.planora.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TaskBranchUpdateDTO {

    @NotBlank(message = "Branch name must not be blank")
    @Size(max = 255, message = "Branch name must not exceed 255 characters")
    @Pattern(
        regexp = "^[a-zA-Z0-9._/\\-]+$",
        message = "Branch name may only contain letters, digits, hyphens, underscores, dots, and forward slashes"
    )
    private String branch;
}
