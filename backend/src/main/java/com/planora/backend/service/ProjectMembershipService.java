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

    /*
     * Verifies if a user belongs to the team that owns the specified project.
     * * * CACHE CONFIGURATION:
     * - key: Creates a unique string identifier like "14:105" (Project 14, User 105).
     * - sync = true: Prevents the "Cache Stampede" problem. If 50 concurrent requests ask
     * if this user is in this project at the exact same millisecond, only 1 thread queries
     * the database while the other 49 wait for the cached boolean result.
     */
    @Cacheable(cacheNames = "project-membership", key = "#projectId + ':' + #userId", sync = true)
    public boolean isProjectMember(Long projectId, Long userId) {
        // Step 1: Figure out which Team actually owns this project.
        Long teamId = resolveProjectTeamId(projectId);

        // Step 2: Delegate to the Team service to see if the user is in that team.
        return teamMembershipLookupService.getTeamMember(teamId, userId) != null;
    }

    /*
     * Projects rarely, if ever, change which team owns them.
     * Caching this simple Long -> Long mapping saves us a costly SQL JOIN operation on every request.
     */
    @Cacheable(cacheNames = "project-team-id", key = "#projectId", sync = true)
    public Long resolveProjectTeamId(Long projectId) {
        Long teamId = projectRepository.findTeamIdByProjectId(projectId);

        // Fail-fast if the project doesn't exist, preventing downstream NullPointerExceptions.
        if (teamId == null) {
            throw new RuntimeException("Project not found");
        }
        return teamId;
    }

    // If it returns silently,
    // the user is authorized. If it throws an exception, execution stops immediately.
    public void assertProjectMembership(Long projectId, User user) {
        // Step 1: Catch edge cases where authentication context is broken.
        if (user == null || user.getUserId() == null) {
            throw new RuntimeException("User is not found");
        }

        // Step 2: Perform the actual (cached) check. Throw exception to halt execution if false.
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
