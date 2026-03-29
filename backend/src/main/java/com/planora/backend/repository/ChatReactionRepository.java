package com.planora.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.planora.backend.model.ChatReaction;

public interface ChatReactionRepository extends JpaRepository<ChatReaction, Long> {

    Optional<ChatReaction> findByMessageIdAndUserUserIdAndEmoji(Long messageId, Long userId, String emoji);

    List<ChatReaction> findByMessageIdOrderByCreatedAtAsc(Long messageId);

    @EntityGraph(attributePaths = {"user"})
    List<ChatReaction> findWithUserByMessageIdOrderByCreatedAtAsc(Long messageId);

    void deleteByMessageId(Long messageId);
}
