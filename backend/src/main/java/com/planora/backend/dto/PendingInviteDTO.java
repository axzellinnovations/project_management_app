// Minimal projection of a pending invitation; used internally where only identity and send-time are needed.
package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class PendingInviteDTO {
    private Long id;                // Invitation record ID for lookup and cancellation.
    private String email;           // Email address the invitation was sent to.
    private LocalDateTime sentAt;   // Timestamp of when the invite was dispatched.
}
