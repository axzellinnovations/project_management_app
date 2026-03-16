package com.planora.backend.model;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private MessageType type;
    private String content;
    private String sender;
    private String recipient;

    private Long projectId;

    private Long roomId;

    private ChatType chatType;

    private Long parentMessageId;

    @Enumerated(EnumType.STRING)
    private FormatType formatType = FormatType.PLAIN;

    private Boolean deleted = false;

    private LocalDateTime deletedAt;

    private LocalDateTime editedAt;

    @CreationTimestamp
    private LocalDateTime timestamp;

    // Enum to define the type of message
    public enum MessageType {
        CHAT,
        JOIN,
        LEAVE
    }

    // Enum to define the chat type
    public enum ChatType {
        GROUP,
        PRIVATE
    }

    public enum FormatType {
        PLAIN,
        MARKDOWN
    }

    // Getters and Setters
//    public MessageType getType() {
//        return type;
//    }
//
//    public void setType(MessageType type) {
//        this.type = type;
//    }
//
//    public String getContent() {
//        return content;
//    }
//
//    public void setContent(String content) {
//        this.content = content;
//    }
//
//    public String getSender() {
//        return sender;
//    }
//
//    public void setSender(String sender) {
//        this.sender = sender;
//    }
//
//    public String getRecipient() {
//        return recipient;
//    }
//
//    public void setRecipient(String recipient) {
//        this.recipient = recipient;
//    }
}
