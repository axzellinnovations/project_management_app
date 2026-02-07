package com.planora.backend.service;

import com.planora.backend.model.Project;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.SprintStatus;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.security.CurrentUserService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class SprintService {

    private final SprintRepository sprintRepository;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final CurrentUserService currentUserService;

    public SprintService(SprintRepository sprintRepository,
                         ProjectRepository projectRepository,
                         TeamMemberRepository teamMemberRepository,
                         CurrentUserService currentUserService) {
        this.sprintRepository = sprintRepository;
        this.projectRepository = projectRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.currentUserService = currentUserService;
    }

    // ---------- Permission helpers (based on your image) ----------

    private TeamRole getRoleForProject(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        Long teamId = project.getTeam().getId();
        Long userId = currentUserService.getUserId();

        TeamMember member = teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new RuntimeException("Access denied: Not a team member"));

        return member.getRole();
    }

    private void requireViewBoard(Long projectId) {
        getRoleForProject(projectId);
    }

    private void requireConfigureBoard(Long projectId) {
        TeamRole role = getRoleForProject(projectId);
        if (!(role == TeamRole.OWNER || role == TeamRole.ADMIN)) {
            throw new RuntimeException("Access denied: OWNER/ADMIN required (CONFIGURE_BOARD)");
        }
    }

    // ---------- Sprint APIs ----------

    // CREATE Sprint -> Configure Board (OWNER/ADMIN)
    public Sprint createSprint(Sprint sprint) {
        requireConfigureBoard(sprint.getProId());

        if (sprint.getStartDate() == null || sprint.getEndDate() == null) {
            throw new RuntimeException("Start date and end date are required");
        }
        if (sprint.getStartDate().isAfter(sprint.getEndDate())) {
            throw new RuntimeException("Start date cannot be after end date");
        }

        // default status (enum)
        if (sprint.getStatus() == null) {
            sprint.setStatus(SprintStatus.NOT_STARTED);
        }

        return sprintRepository.save(sprint);
    }

    // READ Sprints -> View Board (all roles)
    public List<Sprint> getSprintsByProject(Long proId) {
        requireViewBoard(proId);
        return sprintRepository.findByProId(proId);
    }

    // READ Sprint by ID -> View Board
    public Sprint getSprintById(Long id) {
        Sprint sprint = sprintRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        requireViewBoard(sprint.getProId());
        return sprint;
    }

    // UPDATE Sprint -> Configure Board (OWNER/ADMIN)
    public Sprint updateSprint(Long id, Sprint updatedSprint) {
        Sprint existing = sprintRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        requireConfigureBoard(existing.getProId());

        existing.setName(updatedSprint.getName());
        existing.setStartDate(updatedSprint.getStartDate());
        existing.setEndDate(updatedSprint.getEndDate());
        existing.setStatus(updatedSprint.getStatus()); // enum

        if (existing.getStartDate().isAfter(existing.getEndDate())) {
            throw new RuntimeException("Start date cannot be after end date");
        }

        if (existing.getStatus() == null) {
            existing.setStatus(SprintStatus.NOT_STARTED);
        }

        return sprintRepository.save(existing);
    }

    // DELETE Sprint -> Configure Board (OWNER/ADMIN)
    public void deleteSprint(Long id) {
        Sprint existing = sprintRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        requireConfigureBoard(existing.getProId());
        sprintRepository.deleteById(id);
    }

    // START Sprint -> Configure Board (OWNER/ADMIN)
    public Sprint startSprint(Long sprintId, LocalDate startDate, LocalDate endDate) {
        Sprint sprint = sprintRepository.findById(sprintId)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        requireConfigureBoard(sprint.getProId());

        if (sprint.getStatus() == SprintStatus.ACTIVE) {
            throw new RuntimeException("Sprint is already ACTIVE");
        }
        if (sprint.getStatus() == SprintStatus.COMPLETED) {
            throw new RuntimeException("Cannot start a COMPLETED sprint");
        }

        if (startDate == null || endDate == null) {
            throw new RuntimeException("Start date and end date are required");
        }
        if (startDate.isAfter(endDate)) {
            throw new RuntimeException("Start date cannot be after end date");
        }

        boolean activeExists = sprintRepository.existsByProIdAndStatus(sprint.getProId(), SprintStatus.ACTIVE);
        if (activeExists) {
            throw new RuntimeException("Another sprint is already ACTIVE for this project");
        }

        sprint.setStartDate(startDate);
        sprint.setEndDate(endDate);
        sprint.setStatus(SprintStatus.ACTIVE);

        return sprintRepository.save(sprint);
    }
}
