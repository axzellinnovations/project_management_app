package com.planora.backend.service;

import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.model.Milestone;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.repository.MilestoneRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MilestoneServiceTest {

    @Mock
    private MilestoneRepository milestoneRepository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private TeamMemberRepository teamMemberRepository;
    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private MilestoneService milestoneService;

    private Team teamA;
    private Team teamB;
    private Project projectA;
    private Project projectB;
    private TeamMember member;

    @BeforeEach
    void setUp() {
        teamA = new Team();
        teamA.setId(10L);
        teamB = new Team();
        teamB.setId(20L);

        projectA = new Project();
        projectA.setId(100L);
        projectA.setTeam(teamA);

        projectB = new Project();
        projectB.setId(200L);
        projectB.setTeam(teamB);

        member = new TeamMember();
        member.setRole(TeamRole.MEMBER);
    }

    @Test
    void getMilestonesByProject_requiresMembership() {
        when(projectRepository.findById(100L)).thenReturn(Optional.of(projectA));
        when(teamMemberRepository.findByTeamIdAndUserUserId(10L, 999L)).thenReturn(Optional.empty());

        assertThrows(ForbiddenException.class, () -> milestoneService.getMilestonesByProject(100L, 999L));
        verify(milestoneRepository, never()).findByProjectId(any());
    }

    @Test
    void assignTaskToMilestone_rejectsCrossProjectMilestone() {
        Task task = new Task();
        task.setId(1L);
        task.setProject(projectA);

        Milestone otherProjectMilestone = new Milestone();
        otherProjectMilestone.setId(2L);
        otherProjectMilestone.setProject(projectB);

        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));
        when(teamMemberRepository.findByTeamIdAndUserUserId(10L, 500L)).thenReturn(Optional.of(member));
        when(milestoneRepository.findById(2L)).thenReturn(Optional.of(otherProjectMilestone));

        assertThrows(ForbiddenException.class, () -> milestoneService.assignTaskToMilestone(1L, 2L, 500L));
        verify(taskRepository, never()).save(any(Task.class));
    }
}
