package com.planora.backend.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Request DTO for updating user profile.
 * Only fullName can be updated. Email and username updates are not allowed.
 * Profile photo updates are handled by a separate endpoint.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true, allowSetters = false)
public class UpdateProfileRequest {

    @NotBlank(message = "Full name cannot be blank")
    @Size(min = 2, max = 100, message = "Full name must be between 2 and 100 characters")
    private String fullName;
}
