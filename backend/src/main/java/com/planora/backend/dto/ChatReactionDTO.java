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
public class ChatReactionDTO {
    private Long id;
    private Long userId;
    private String username;
    private String emoji;
    private LocalDateTime createdAt;
}
