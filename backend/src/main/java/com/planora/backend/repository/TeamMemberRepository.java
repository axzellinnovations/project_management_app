// JPA repository for TeamMember; provides membership lookups used by both permission checks and the members page.
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
    @EntityGraph(attributePaths = { "user", "team" })
    Optional<TeamMember> findByTeamIdAndUserUserId(Long teamId, Long userId);

    // Fetches all teams a user belongs to; loads owner details to support the team dashboard.
    @EntityGraph(attributePaths = { "team.owner", "team", "user" })
    List<TeamMember> findByUserUserId(Long currentUserId);

    // Get all members of a team
    @EntityGraph(attributePaths = { "user" })
    List<TeamMember> findByTeamId(Long teamId);

    // Bulk-fetches members across multiple teams; used to resolve display info for cross-project task lists.
    @EntityGraph(attributePaths = { "user" })
    List<TeamMember> findByTeamIdIn(Set<Long> teamIds);

    // Resolves which teams a user is part of from a given set; powers the N+1-safe bulk permission check.
    @EntityGraph(attributePaths = { "user", "team" })
    List<TeamMember> findByTeamIdInAndUserUserId(Set<Long> teamIds, Long userId);

    // Fetches members of a team filtered by a set of user IDs; used to validate bulk-invite targets.
    @EntityGraph(attributePaths = { "user", "team" })
    List<TeamMember> findByTeamIdAndUserUserIdIn(Long teamId, java.util.Collection<Long> userIds);

    // Retrieves all OWNER/ADMIN members of a team; used when broadcasting admin-only notifications.
    List<TeamMember> findByTeamIdAndRoleIn(Long teamId, Set<com.planora.backend.model.TeamRole> roles);
}
