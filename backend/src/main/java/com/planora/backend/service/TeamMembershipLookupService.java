package com.planora.backend.service;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.planora.backend.model.TeamMember;
import com.planora.backend.repository.TeamMemberRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TeamMembershipLookupService {

    private final TeamMemberRepository teamMemberRepository;

    @Cacheable(cacheNames = "team-member", key = "#teamId + ':' + #userId", unless = "#result == null")
    public TeamMember getTeamMember(Long teamId, Long userId) {
        return teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId).orElse(null);
    }

    public java.util.List<TeamMember> getTeamMembersForTeams(java.util.Set<Long> teamIds, Long userId) {
        if (teamIds == null || teamIds.isEmpty() || userId == null) {
            return java.util.List.of();
        }
        return teamMemberRepository.findByTeamIdInAndUserUserId(teamIds, userId);
    }
}
