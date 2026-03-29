package com.planora.backend.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PendingInviteResponseDTO {
    private Long id;
    private String email;
    private LocalDateTime invitedAt;
    private String status; // Always "Pending"
    private String role; // Invited role (OWNER, ADMIN, MEMBER, VIEWER)
}