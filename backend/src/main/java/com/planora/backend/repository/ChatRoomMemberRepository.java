package com.planora.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.model.ChatRoomMember;

public interface ChatRoomMemberRepository extends JpaRepository<ChatRoomMember, Long> {
    List<ChatRoomMember> findByChatRoomId(Long roomId);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"chatRoom"})
    List<ChatRoomMember> findByUserUserId(Long userId);
    Optional<ChatRoomMember> findByChatRoomIdAndUserUserId(Long roomId, Long userId);
    @Modifying
    @Transactional
    void deleteByChatRoomId(Long roomId);
}
