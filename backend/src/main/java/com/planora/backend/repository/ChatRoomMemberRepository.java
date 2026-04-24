package com.planora.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.model.ChatRoomMember;

public interface ChatRoomMemberRepository extends JpaRepository<ChatRoomMember, Long> {
    List<ChatRoomMember> findByChatRoomId(Long roomId);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"chatRoom"})
    // Fetch room metadata with membership to avoid N+1 in inbox/sidebar views.
    List<ChatRoomMember> findByUserUserId(Long userId);
    @Query("select distinct crm.chatRoom.id from ChatRoomMember crm where crm.user.userId = :userId")
    List<Long> findRoomIdsByUserId(Long userId);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"chatRoom", "user"})
    List<ChatRoomMember> findByUserUserIdIn(java.util.Collection<Long> userIds);
    Optional<ChatRoomMember> findByChatRoomIdAndUserUserId(Long roomId, Long userId);
    @Modifying
    @Transactional
    // Used by room deletion to remove dependent rows before deleting the room.
    void deleteByChatRoomId(Long roomId);
}
