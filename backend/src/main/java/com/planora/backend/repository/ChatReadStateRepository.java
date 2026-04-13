package com.planora.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.planora.backend.model.ChatReadState;

public interface ChatReadStateRepository extends JpaRepository<ChatReadState, Long> {

    Optional<ChatReadState> findByProjectIdAndUserUserIdAndRoomId(Long projectId, Long userId, Long roomId);

    Optional<ChatReadState> findByProjectIdAndUserUserIdAndOtherParticipantIgnoreCase(Long projectId, Long userId, String otherParticipant);
    java.util.List<ChatReadState> findByProjectIdAndUserUserId(Long projectId, Long userId);
}
