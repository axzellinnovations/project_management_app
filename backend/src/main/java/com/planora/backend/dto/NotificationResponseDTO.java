// Data Transfer Object for returning notification details to the client.
package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationResponseDTO {
    private Long id;
    private String message;
    private String link;
    private boolean isRead;
    private LocalDateTime createdAt;
}
