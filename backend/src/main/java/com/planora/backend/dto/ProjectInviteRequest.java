package com.planora.backend.dto;

import com.planora.backend.model.TeamRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProjectInviteRequest {
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email address")
    private String email;

    @NotNull(message = "Role is required")
    private TeamRole role;
}