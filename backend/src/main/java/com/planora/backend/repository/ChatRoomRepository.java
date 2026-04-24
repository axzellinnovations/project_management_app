package com.planora.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.planora.backend.model.ChatRoom;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
    // Project-scoped room listing powers chat sidebar and inbox aggregation.
    List<ChatRoom> findByProjectId(Long projectId);
    List<ChatRoom> findByProjectIdIn(java.util.Collection<Long> projectIds);
    // Dual-key lookup prevents cross-project room access.
    Optional<ChatRoom> findByIdAndProjectId(Long id, Long projectId);
}
