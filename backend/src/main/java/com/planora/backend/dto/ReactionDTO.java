package com.planora.backend.dto;

import java.time.LocalDateTime;

public record ReactionDTO(
    Long id,
    String emoji,
    Long userId,
    String username,
    LocalDateTime createdAt
) {}
