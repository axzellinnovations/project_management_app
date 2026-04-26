// Response shape for unaccepted team invitations shown in the pending section of the members page.
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
    private Long id;                    // Invitation record ID; used to cancel or resend the invite.
    private String email;               // Invitee's email address; the invite token is sent here.
    private LocalDateTime invitedAt;    // When the invitation was issued; helps identify stale invites.
    private String status;              // Always "Pending" for this endpoint's results.
    private String role;                // Role that will be granted on acceptance (OWNER, ADMIN, MEMBER, VIEWER).
}