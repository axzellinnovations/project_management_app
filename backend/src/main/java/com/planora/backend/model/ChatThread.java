package com.planora.backend.model;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "chat_thread", indexes = {
        @Index(name = "idx_chat_thread_project_root", columnList = "projectId,rootMessageId", unique = true)
})
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class ChatThread {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long projectId;

    private Long rootMessageId;

    private Long roomId;

    private String createdBy;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
