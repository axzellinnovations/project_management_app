package com.planora.backend.service;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.planora.backend.model.TeamMember;
import com.planora.backend.repository.TeamMemberRepository;

import lombok.RequiredArgsConstructor;

/*
 * Spring's @Cacheable annotations only work if the method is called from completely
 * OUTSIDE the class (so it can intercept the call via a proxy). By isolating these
 * lookups here, we guarantee that whenever TaskService or ProjectMembershipService
 * asks for a TeamMember, they reliably hit the caching layer.
 */
@Service
@RequiredArgsConstructor
public class TeamMembershipLookupService {

    private final TeamMemberRepository teamMemberRepository;

    /*
     * Resolves a specific user's membership in a specific team.
     * * CACHE CONFIGURATION:
     * - key: Combines team and user ID (e.g., "14:105").
     * - unless = "#result == null": We explicitly tell Spring NOT to cache null results.
     * This prevents "Cache Poisoning" / memory exhaustion if a malicious script tries
     * to query thousands of random, non-existent team-user combinations.
     */
    @Cacheable(cacheNames = "team-member", key = "#teamId + ':' + #userId", unless = "#result == null")
    public TeamMember getTeamMember(Long teamId, Long userId) {
        return teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId).orElse(null);
    }

    /*
     * Bulk fetches membership data for multiple teams in a single database query.
     * PERFORMANCE OPTIMIZATION:
     * Used heavily by TaskService.bulkUpdateStatus and bulkDelete.
     * If a user selects 50 tasks across 3 different projects and hits "Delete",
     * this method ensures we only run ONE SQL query using an `IN (...)` clause,
     * rather than firing 50 separate queries (The N+1 Query Problem).
     */
    public java.util.List<TeamMember> getTeamMembersForTeams(java.util.Set<Long> teamIds, Long userId) {
        // Step 1: Fast exit to prevent executing a broken query if data is missing.
        if (teamIds == null || teamIds.isEmpty() || userId == null) {
            return java.util.List.of();
        }

        // Step 2: Fire the bulk fetch.
        // Example SQL generated: SELECT * FROM team_members WHERE user_id = ? AND team_id IN (?, ?, ?)
        return teamMemberRepository.findByTeamIdInAndUserUserId(teamIds, userId);
    }
}
