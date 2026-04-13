
package com.planora.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.planora.backend.model.ChatMessage;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

       @Query("""
              SELECT DISTINCT m FROM ChatMessage m
              LEFT JOIN FETCH m.reactions r
              LEFT JOIN FETCH r.user
              WHERE m.projectId = :projectId
                AND m.roomId = :roomId
                AND m.parentMessageId IS NULL
              ORDER BY m.id ASC
       """)
       java.util.List<ChatMessage> fetchRoomMessagesWithReactionsAndSenders(
              @Param("projectId") Long projectId,
              @Param("roomId") Long roomId
       );

    Optional<ChatMessage> findByIdAndProjectId(Long id, Long projectId);

    @EntityGraph(attributePaths = {"reactions", "reactions.user"})
    List<ChatMessage> findByProjectIdAndRecipientIsNullAndRoomIdIsNullAndParentMessageIdIsNullOrderByIdAsc(Long projectId);

    @EntityGraph(attributePaths = {"reactions", "reactions.user"})
    List<ChatMessage> findByProjectIdAndRoomIdAndParentMessageIdIsNullOrderByIdAsc(Long projectId, Long roomId);

    @EntityGraph(attributePaths = {"reactions", "reactions.user"})
    List<ChatMessage> findByProjectIdAndParentMessageIdOrderByIdAsc(Long projectId, Long parentMessageId);

    Optional<ChatMessage> findTopByProjectIdAndRoomIdAndParentMessageIdIsNullOrderByIdDesc(Long projectId, Long roomId);

    Optional<ChatMessage> findTopByProjectIdAndRecipientIsNullAndRoomIdIsNullAndParentMessageIdIsNullOrderByIdDesc(Long projectId);

    // private conversation between two users in a project
    @Query("SELECT DISTINCT m FROM ChatMessage m " +
           "LEFT JOIN FETCH m.reactions r " +
           "LEFT JOIN FETCH r.user " +
           "WHERE m.projectId = :projectId AND m.parentMessageId IS NULL " +
           "AND ((m.sender = :user AND m.recipient = :other) OR (m.sender = :other AND m.recipient = :user)) " +
           "ORDER BY m.id ASC")
    List<ChatMessage> findConversation(@Param("projectId") Long projectId, @Param("user") String user, @Param("other") String other);

    @Query("SELECT DISTINCT m FROM ChatMessage m " +
           "LEFT JOIN FETCH m.reactions r " +
           "LEFT JOIN FETCH r.user " +
           "WHERE m.projectId = :projectId AND m.parentMessageId IS NULL " +
           "AND ((m.sender = :user AND m.recipient = :other) OR (m.sender = :other AND m.recipient = :user)) " +
           "ORDER BY m.id DESC")
    List<ChatMessage> findLatestConversationMessages(@Param("projectId") Long projectId, @Param("user") String user, @Param("other") String other);

    @Query("SELECT DISTINCT m FROM ChatMessage m " +
           "LEFT JOIN FETCH m.reactions r " +
           "LEFT JOIN FETCH r.user " +
           "WHERE m.projectId = :projectId AND m.parentMessageId IS NULL " +
           "AND ((LOWER(m.sender) IN :userAliases AND LOWER(m.recipient) IN :otherAliases) OR (LOWER(m.sender) IN :otherAliases AND LOWER(m.recipient) IN :userAliases)) " +
           "ORDER BY m.id ASC")
    List<ChatMessage> findConversationByAliases(@Param("projectId") Long projectId,
                                                @Param("userAliases") List<String> userAliases,
                                                @Param("otherAliases") List<String> otherAliases);

    @Query("SELECT DISTINCT m FROM ChatMessage m " +
           "LEFT JOIN FETCH m.reactions r " +
           "LEFT JOIN FETCH r.user " +
           "WHERE m.projectId = :projectId AND m.parentMessageId IS NULL " +
           "AND ((LOWER(m.sender) IN :userAliases AND LOWER(m.recipient) IN :otherAliases) OR (LOWER(m.sender) IN :otherAliases AND LOWER(m.recipient) IN :userAliases)) " +
           "ORDER BY m.id DESC")
    List<ChatMessage> findLatestConversationMessagesByAliases(@Param("projectId") Long projectId,
                                                              @Param("userAliases") List<String> userAliases,
                                                              @Param("otherAliases") List<String> otherAliases);

    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.projectId = :projectId AND m.roomId = :roomId AND m.parentMessageId IS NULL AND LOWER(m.sender) <> LOWER(:currentUser) AND (:lastReadMessageId IS NULL OR m.id > :lastReadMessageId)")
    long countUnreadRoomMessages(@Param("projectId") Long projectId,
                                 @Param("roomId") Long roomId,
                                 @Param("currentUser") String currentUser,
                                 @Param("lastReadMessageId") Long lastReadMessageId);

    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.projectId = :projectId AND m.roomId = :roomId AND m.parentMessageId IS NULL AND LOWER(m.sender) NOT IN :currentUserAliases AND (:lastReadMessageId IS NULL OR m.id > :lastReadMessageId)")
    long countUnreadRoomMessagesByAliases(@Param("projectId") Long projectId,
                                          @Param("roomId") Long roomId,
                                          @Param("currentUserAliases") List<String> currentUserAliases,
                                          @Param("lastReadMessageId") Long lastReadMessageId);

    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.projectId = :projectId AND m.parentMessageId IS NULL AND LOWER(m.sender) = LOWER(:otherUser) AND LOWER(m.recipient) = LOWER(:currentUser) AND (:lastReadMessageId IS NULL OR m.id > :lastReadMessageId)")
    long countUnreadPrivateMessages(@Param("projectId") Long projectId,
                                    @Param("otherUser") String otherUser,
                                    @Param("currentUser") String currentUser,
                                    @Param("lastReadMessageId") Long lastReadMessageId);

    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.projectId = :projectId AND m.parentMessageId IS NULL AND LOWER(m.sender) IN :otherAliases AND LOWER(m.recipient) IN :currentUserAliases AND (:lastReadMessageId IS NULL OR m.id > :lastReadMessageId)")
    long countUnreadPrivateMessagesByAliases(@Param("projectId") Long projectId,
                                             @Param("otherAliases") List<String> otherAliases,
                                             @Param("currentUserAliases") List<String> currentUserAliases,
                                             @Param("lastReadMessageId") Long lastReadMessageId);

    @Query("SELECT COUNT(m) FROM ChatMessage m WHERE m.projectId = :projectId AND m.recipient IS NULL AND m.roomId IS NULL AND m.parentMessageId IS NULL AND LOWER(m.sender) NOT IN :currentUserAliases AND (:lastReadMessageId IS NULL OR m.id > :lastReadMessageId)")
    long countUnreadTeamMessagesByAliases(@Param("projectId") Long projectId,
                                          @Param("currentUserAliases") List<String> currentUserAliases,
                                          @Param("lastReadMessageId") Long lastReadMessageId);

    @Query("SELECT m.roomId as roomId, COUNT(m) as count FROM ChatMessage m " +
           "WHERE m.projectId = :projectId AND m.roomId IN :roomIds AND m.parentMessageId IS NULL " +
           "AND LOWER(m.sender) NOT IN :currentUserAliases " +
           "GROUP BY m.roomId")
    List<Object[]> countUnreadBatchRooms(@Param("projectId") Long projectId,
                                        @Param("roomIds") List<Long> roomIds,
                                        @Param("currentUserAliases") List<String> currentUserAliases);

    @Query("SELECT LOWER(m.sender) as other, COUNT(m) as count FROM ChatMessage m " +
           "WHERE m.projectId = :projectId AND m.recipient IN :currentUserAliases " +
           "AND m.parentMessageId IS NULL " +
           "GROUP BY LOWER(m.sender)")
    List<Object[]> countUnreadBatchDirects(@Param("projectId") Long projectId,
                                          @Param("currentUserAliases") List<String> currentUserAliases);

    @EntityGraph(attributePaths = {"reactions", "reactions.user"})
    @Query("SELECT DISTINCT m FROM ChatMessage m WHERE m.projectId = :projectId AND m.content IS NOT NULL AND LOWER(m.content) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY m.id DESC")
    List<ChatMessage> searchMessages(@Param("projectId") Long projectId,
                                     @Param("query") String query);

    @Query("SELECT m FROM ChatMessage m WHERE m.id IN (SELECT MAX(m2.id) FROM ChatMessage m2 WHERE m2.projectId = :projectId AND m2.roomId IN :roomIds GROUP BY m2.roomId)")
    List<ChatMessage> findLatestMessagesForSpecificRooms(@Param("projectId") Long projectId, @Param("roomIds") List<Long> roomIds);

    @Query("SELECT m FROM ChatMessage m WHERE m.id IN (SELECT MAX(m2.id) FROM ChatMessage m2 WHERE m2.projectId = :projectId AND (LOWER(m2.sender) IN :userAliases OR LOWER(m2.recipient) IN :userAliases) AND m2.recipient IS NOT NULL GROUP BY m2.sender, m2.recipient)")
    List<ChatMessage> findLatestMessagesForSpecificDirects(@Param("projectId") Long projectId, @Param("userAliases") List<String> userAliases);

    @Query("SELECT m FROM ChatMessage m WHERE m.id IN (SELECT MAX(m2.id) FROM ChatMessage m2 WHERE m2.projectId IN :projectIds AND m2.recipient IS NULL AND m2.roomId IS NULL AND m2.parentMessageId IS NULL GROUP BY m2.projectId)")
    List<ChatMessage> findLatestTeamMessagesForProjects(@Param("projectIds") List<Long> projectIds);
}
