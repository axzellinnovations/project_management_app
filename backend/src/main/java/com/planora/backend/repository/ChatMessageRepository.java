package com.planora.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.planora.backend.model.ChatMessage;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    // group messages for a project have no recipient and no room
    List<ChatMessage> findByProjectIdAndRecipientIsNullAndRoomIdIsNullOrderByIdAsc(Long projectId);

    // room-based group messages
    List<ChatMessage> findByProjectIdAndRoomIdOrderByIdAsc(Long projectId, Long roomId);

    // private conversation between two users in a project
    @Query("SELECT m FROM ChatMessage m WHERE m.projectId = :projectId AND ((m.sender = :user AND m.recipient = :other) OR (m.sender = :other AND m.recipient = :user)) ORDER BY m.id ASC")
    List<ChatMessage> findConversation(@Param("projectId") Long projectId, @Param("user") String user, @Param("other") String other);
}
