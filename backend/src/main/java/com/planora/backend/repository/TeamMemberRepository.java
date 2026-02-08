package com.planora.backend.repository;

import com.planora.backend.model.TeamMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {

    // Find a specific user in a team (used for permission checks)
    Optional<TeamMember> findByTeamIdAndUserUserId(Long teamId, Long userId);

    // Get all members of a team
    List<TeamMember> findByTeamId(Long teamId);
}
