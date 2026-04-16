package com.planora.backend.dto;

import com.planora.backend.model.ChatMessage;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ChatMessageDTO {
    private Long id;
    private String localId;
    private ChatMessage.MessageType type;
    private String content;
    private String sender;
    private String recipient;
    private Long projectId;
    private Long roomId;
    private ChatMessage.ChatType chatType;
    private Long parentMessageId;
    private ChatMessage.FormatType formatType;
    private Boolean deleted;
    private LocalDateTime deletedAt;
    private LocalDateTime editedAt;
    private LocalDateTime timestamp;
    private List<ChatReactionDTO> reactions;
}
