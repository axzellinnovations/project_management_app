package com.planora.backend.service;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProjectMembershipService {

    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;

    @Cacheable(cacheNames = "project-membership", key = "#projectId + ':' + #userId", unless = "#result == false")
    public boolean isProjectMember(Long projectId, Long userId) {
        var project = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Project not found"));
        return teamMemberRepository.findByTeamIdAndUserUserId(project.getTeam().getId(), userId).isPresent();
    }

    public void assertProjectMembership(Long projectId, User user) {
        if (user == null || user.getUserId() == null) {
            throw new RuntimeException("User is not found");
        }
        if (!isProjectMember(projectId, user.getUserId())) {
            throw new RuntimeException("User is not a member of the project");
        }
    }
}
