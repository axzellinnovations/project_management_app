package com.planora.backend.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.planora.backend.model.ChatMessage;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
// DTO shared by REST and STOMP flows so both chat delivery paths keep one payload contract.
public class ChatMessageDTO {
    // Database id after persistence; null when message is still optimistic on the client.
    private Long id;
    // Client-generated id used to reconcile websocket echoes with pending UI messages.
    private String localId;
    private ChatMessage.MessageType type;
    private String content;
    // Sender/recipient stay as aliases for compatibility with existing chat records.
    private String sender;
    private String recipient;
    private Long projectId;
    private Long roomId;
    private ChatMessage.ChatType chatType;
    // Non-null when message belongs to a thread under a root message.
    private Long parentMessageId;
    private ChatMessage.FormatType formatType;
    // Soft-delete metadata preserves timeline order without hard removing rows.
    private Boolean deleted;
    private LocalDateTime deletedAt;
    private LocalDateTime editedAt;
    private LocalDateTime timestamp;
    // Hydrated reactions avoid extra round trips for initial message rendering.
    private List<ChatReactionDTO> reactions;
}
