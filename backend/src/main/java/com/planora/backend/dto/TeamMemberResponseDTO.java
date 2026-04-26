// Full response payload returned to the members page, bundling membership metadata with user profile info.
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
    private Long id;          // TeamMember entity ID; used by the frontend to target role-change/remove requests.
    private String role;      // Current role string (e.g., "OWNER", "ADMIN") sent as-is to avoid enum serialisation issues.
    private UserInfo user;    // Nested profile details—keeps user data co-located with membership data in one response.

    private Long taskCount;                        // Number of tasks assigned to this member within the team's projects.
    private java.time.LocalDateTime lastActive;    // Last activity timestamp; displayed as the "last seen" indicator.

    // Distinguishes active members from pending invitees on the members page.
    private String status; // "Active" or "Pending"

    // Nested DTO carrying only the user fields the members page needs; avoids exposing the full User entity.
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserInfo {
        private Long userId;          // Used as the key when targeting member-specific API calls.
        private String username;      // Short handle; fallback display when fullName is blank.
        private String fullName;      // Preferred display name shown in the members list.
        private String email;         // Used for invite lookup and member identification.
        private String profilePicUrl; // Pre-signed S3 URL generated at query time for secure image access.
    }
}
