package com.planora.backend.repository;

import com.planora.backend.model.TeamMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {
    Optional<TeamMember> findByTeamIdAndUserUserId(Long teamId, Long userId);

    List<TeamMember> findByUserUserId(Long currentUserId);
}
