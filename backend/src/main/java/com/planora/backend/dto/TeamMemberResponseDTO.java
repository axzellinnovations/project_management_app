package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeamMemberResponseDTO {
    private Long id;
    private String role;
    private UserInfo user;

    private Long taskCount;
    private java.time.LocalDateTime lastActive;

    private String status; // "Active" or "Pending"

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserInfo {
        private Long userId;
        private String username;
        private String fullName;
        private String email;
        private String profilePicUrl;
    }
}
