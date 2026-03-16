package com.planora.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.planora.backend.model.ChatMessage;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    // group messages for a project have no recipient and no room
    List<ChatMessage> findByProjectIdAndRecipientIsNullAndRoomIdIsNullOrderByIdAsc(Long projectId);

    // room-based group messages
    List<ChatMessage> findByProjectIdAndRoomIdOrderByIdAsc(Long projectId, Long roomId);

    Optional<ChatMessage> findTopByProjectIdAndRoomIdOrderByIdDesc(Long projectId, Long roomId);

    // private conversation between two users in a project
    @Query("SELECT m FROM ChatMessage m WHERE m.projectId = :projectId AND ((m.sender = :user AND m.recipient = :other) OR (m.sender = :other AND m.recipient = :user)) ORDER BY m.id ASC")
    List<ChatMessage> findConversation(@Param("projectId") Long projectId, @Param("user") String user, @Param("other") String other);

    @Query("SELECT m FROM ChatMessage m WHERE m.projectId = :projectId AND ((m.sender = :user AND m.recipient = :other) OR (m.sender = :other AND m.recipient = :user)) ORDER BY m.id DESC")
    List<ChatMessage> findLatestConversationMessages(@Param("projectId") Long projectId, @Param("user") String user, @Param("other") String other);

    @Query("SELECT m FROM ChatMessage m WHERE m.projectId = :projectId AND ((LOWER(m.sender) IN :userAliases AND LOWER(m.recipient) IN :otherAliases) OR (LOWER(m.sender) IN :otherAliases AND LOWER(m.recipient) IN :userAliases)) ORDER BY m.id ASC")
    List<ChatMessage> findConversationByAliases(@Param("projectId") Long projectId,
                                                @Param("userAliases") List<String> userAliases,
                                                @Param("otherAliases") List<String> otherAliases);

    @Query("SELECT m FROM ChatMessage m WHERE m.projectId = :projectId AND ((LOWER(m.sender) IN :userAliases AND LOWER(m.recipient) IN :otherAliases) OR (LOWER(m.sender) IN :otherAliases AND LOWER(m.recipient) IN :userAliases)) ORDER BY m.id DESC")
    List<ChatMessage> findLatestConversationMessagesByAliases(@Param("projectId") Long projectId,
                                                              @Param("userAliases") List<String> userAliases,
                                                              @Param("otherAliases") List<String> otherAliases);

    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.projectId = :projectId AND m.roomId = :roomId AND LOWER(m.sender) <> LOWER(:currentUser) AND (:lastReadMessageId IS NULL OR m.id > :lastReadMessageId)")
    long countUnreadRoomMessages(@Param("projectId") Long projectId,
                                 @Param("roomId") Long roomId,
                                 @Param("currentUser") String currentUser,
                                 @Param("lastReadMessageId") Long lastReadMessageId);

    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.projectId = :projectId AND m.roomId = :roomId AND LOWER(m.sender) NOT IN :currentUserAliases AND (:lastReadMessageId IS NULL OR m.id > :lastReadMessageId)")
    long countUnreadRoomMessagesByAliases(@Param("projectId") Long projectId,
                                          @Param("roomId") Long roomId,
                                          @Param("currentUserAliases") List<String> currentUserAliases,
                                          @Param("lastReadMessageId") Long lastReadMessageId);

    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.projectId = :projectId AND LOWER(m.sender) = LOWER(:otherUser) AND LOWER(m.recipient) = LOWER(:currentUser) AND (:lastReadMessageId IS NULL OR m.id > :lastReadMessageId)")
    long countUnreadPrivateMessages(@Param("projectId") Long projectId,
                                    @Param("otherUser") String otherUser,
                                    @Param("currentUser") String currentUser,
                                    @Param("lastReadMessageId") Long lastReadMessageId);

    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.projectId = :projectId AND LOWER(m.sender) IN :otherAliases AND LOWER(m.recipient) IN :currentUserAliases AND (:lastReadMessageId IS NULL OR m.id > :lastReadMessageId)")
    long countUnreadPrivateMessagesByAliases(@Param("projectId") Long projectId,
                                             @Param("otherAliases") List<String> otherAliases,
                                             @Param("currentUserAliases") List<String> currentUserAliases,
                                             @Param("lastReadMessageId") Long lastReadMessageId);
}
