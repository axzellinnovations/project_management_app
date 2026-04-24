package com.planora.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.planora.backend.model.ChatThread;

public interface ChatThreadRepository extends JpaRepository<ChatThread, Long> {

    // Root lookup keeps thread topic broadcasting consistent across REST and websocket flows.
    Optional<ChatThread> findByProjectIdAndRootMessageId(Long projectId, Long rootMessageId);
}
