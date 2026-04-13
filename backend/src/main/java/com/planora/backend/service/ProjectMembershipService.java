package com.planora.backend.service;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProjectMembershipService {

    private final ProjectRepository projectRepository;
    private final TeamMembershipLookupService teamMembershipLookupService;

    @Cacheable(cacheNames = "project-membership", key = "#projectId + ':' + #userId", sync = true)
    public boolean isProjectMember(Long projectId, Long userId) {
        Long teamId = resolveProjectTeamId(projectId);
        return teamMembershipLookupService.getTeamMember(teamId, userId) != null;
    }

    @Cacheable(cacheNames = "project-team-id", key = "#projectId", sync = true)
    public Long resolveProjectTeamId(Long projectId) {
        Long teamId = projectRepository.findTeamIdByProjectId(projectId);
        if (teamId == null) {
            throw new RuntimeException("Project not found");
        }
        return teamId;
    }

    public void assertProjectMembership(Long projectId, User user) {
        if (user == null || user.getUserId() == null) {
            throw new RuntimeException("User is not found");
        }
        if (!isProjectMember(projectId, user.getUserId())) {
            throw new RuntimeException("User is not a member of the project");
        }
    }

    public void assertTeamMembership(Long teamId, User user) {
        if (user == null || user.getUserId() == null) {
            throw new RuntimeException("User is not found");
        }
        if (teamId == null || teamMembershipLookupService.getTeamMember(teamId, user.getUserId()) == null) {
            throw new RuntimeException("User is not a member of the project");
        }
    }
}
