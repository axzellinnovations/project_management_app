package com.planora.backend.dto;

import lombok.Data;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Request DTO for updating user profile.
 * Email and username changes are not allowed via this endpoint.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true, allowSetters = false)
public class UpdateProfileRequest {

    @Size(min = 2, max = 100, message = "Full name must be between 2 and 100 characters")
    private String fullName;

    @Size(max = 100)
    private String firstName;

    @Size(max = 100)
    private String lastName;

    @Size(max = 30)
    private String contactNumber;

    @Size(max = 10)
    private String countryCode;

    @Size(max = 150)
    private String jobTitle;

    @Size(max = 150)
    private String company;

    @Size(max = 150)
    private String position;

    @Size(max = 300, message = "Bio cannot exceed 300 characters")
    private String bio;
}
