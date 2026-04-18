package com.planora.backend.service;

import com.planora.backend.model.Milestone;
import com.planora.backend.model.Project;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.Task;
import com.planora.backend.model.TeamMember;
import com.planora.backend.repository.MilestoneRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Gathers all raw data needed to build a project report attachment.
 * Used by the scheduled report email dispatcher.
 */
@Service
public class ProjectReportDataService {

    private final ProjectRepository    projectRepo;
    private final TaskRepository       taskRepo;
    private final SprintRepository     sprintRepo;
    private final MilestoneRepository  milestoneRepo;
    private final TeamMemberRepository memberRepo;

    public ProjectReportDataService(ProjectRepository projectRepo,
                                    TaskRepository taskRepo,
                                    SprintRepository sprintRepo,
                                    MilestoneRepository milestoneRepo,
                                    TeamMemberRepository memberRepo) {
        this.projectRepo   = projectRepo;
        this.taskRepo      = taskRepo;
        this.sprintRepo    = sprintRepo;
        this.milestoneRepo = milestoneRepo;
        this.memberRepo    = memberRepo;
    }

    /** Aggregated snapshot of a project for report generation. */
    public record ReportSnapshot(
        Project            project,
        List<Task>         tasks,
        List<Sprint>       sprints,
        List<Milestone>    milestones,
        List<TeamMember>   members,
        LocalDate          generatedOn
    ) {}

    @Transactional(readOnly = true)
    public ReportSnapshot loadSnapshot(Long projectId) {
        Project project = projectRepo.findById(projectId)
            .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));

        List<Task>      tasks      = taskRepo.findByProjectIdWithScalars(projectId);
        List<Sprint>    sprints    = sprintRepo.findByProject_Id(projectId);
        List<Milestone> milestones = milestoneRepo.findByProjectId(projectId);
        List<TeamMember> members  = memberRepo.findByTeamId(project.getTeam().getId());

        return new ReportSnapshot(project, tasks, sprints, milestones, members, LocalDate.now());
    }
}
