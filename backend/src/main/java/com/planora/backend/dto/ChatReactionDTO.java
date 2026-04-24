package com.planora.backend.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
// Lightweight reaction projection returned with messages and reaction summary endpoints.
public class ChatReactionDTO {
    private Long id;
    // userId/username are duplicated here to avoid client-side joins for reaction chips.
    private Long userId;
    private String username;
    private String emoji;
    // Timestamp keeps reaction ordering deterministic across clients.
    private LocalDateTime createdAt;
}
