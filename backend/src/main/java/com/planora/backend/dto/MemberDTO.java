// Lightweight projection used to surface member identity and role to the members page.
package com.planora.backend.dto;

import com.planora.backend.model.TeamRole;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MemberDTO {
    private Long userId;              // Unique identifier for the user account.
    private String fullName;          // Display name shown on the members page.
    private String email;             // Contact address; also used as the invite identifier.
    private TeamRole role;            // Current permission level within the team.
    private LocalDateTime joinedAt;   // Timestamp recorded when the membership was first created.
}
