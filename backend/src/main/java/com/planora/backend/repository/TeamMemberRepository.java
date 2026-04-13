package com.planora.backend.repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.planora.backend.model.TeamMember;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {

    // Find a specific user in a team (used for permission checks)
    Optional<TeamMember> findByTeamIdAndUserUserId(Long teamId, Long userId);

    @EntityGraph(attributePaths = {"team.owner", "team", "user"})
    List<TeamMember> findByUserUserId(Long currentUserId);
    // Get all members of a team
    @EntityGraph(attributePaths = {"user"})
    List<TeamMember> findByTeamId(Long teamId);

    @EntityGraph(attributePaths = {"user"})
    List<TeamMember> findByTeamIdIn(Set<Long> teamIds);

    @EntityGraph(attributePaths = {"user", "team"})
    List<TeamMember> findByTeamIdInAndUserUserId(Set<Long> teamIds, Long userId);

    @EntityGraph(attributePaths = {"user", "team"})
    List<TeamMember> findByTeamIdAndUserUserIdIn(Long teamId, java.util.Collection<Long> userIds);

    List<TeamMember> findByTeamIdAndRoleIn(Long teamId, Set<com.planora.backend.model.TeamRole> roles);
}
