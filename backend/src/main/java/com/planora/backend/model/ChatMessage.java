package com.planora.backend.model;

import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
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
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChatMessage {
    
    @jakarta.persistence.OneToMany(mappedBy = "message", cascade = jakarta.persistence.CascadeType.ALL, fetch = jakarta.persistence.FetchType.LAZY)
    @JsonIgnore
    private java.util.List<ChatReaction> reactions = new java.util.ArrayList<>();

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private MessageType type;

    @Column(columnDefinition = "text")
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ChatMessage message = (ChatMessage) o;
        return java.util.Objects.equals(id, message.id);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(id);
    }
}
