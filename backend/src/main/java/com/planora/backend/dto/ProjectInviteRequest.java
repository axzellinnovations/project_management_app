package com.planora.backend.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProjectInviteRequest {
    private String email;
    private String role; // e.g., OWNER, ADMIN, MEMBER, VIEWER
}