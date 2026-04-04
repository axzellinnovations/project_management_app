package com.planora.backend.service;

import com.planora.backend.model.Project;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.SprintStatus;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.SprintboardRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.model.Task;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class SprintService {

    private final SprintRepository sprintRepository;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final SprintboardService sprintboardService;
    private final TaskRepository taskRepository;
    private final SprintboardRepository sprintboardRepository;

    public SprintService(SprintRepository sprintRepository,
                         ProjectRepository projectRepository,
                         TeamMemberRepository teamMemberRepository,
                         UserRepository userRepository,
                         SprintboardService sprintboardService,
                         TaskRepository taskRepository,
                         SprintboardRepository sprintboardRepository) {
        this.sprintRepository = sprintRepository;
        this.projectRepository = projectRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.userRepository = userRepository;
        this.sprintboardService = sprintboardService;
        this.taskRepository = taskRepository;
        this.sprintboardRepository = sprintboardRepository;
    }

    // ---------- Get Current User from SecurityContext ----------

    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            throw new RuntimeException("Unauthorized");
        }

        // In your JwtFilter, auth.getName() will be the email/username
        String email = auth.getName();

        // Adjust this depending on your repository return type
        // If findByEmail returns Optional<User>
        User user = userRepository.findByEmail(email);

        if (user == null) {
            throw new RuntimeException("User not found for email: " + email);
        }

        return user.getUserId();

    }

    // ---------- Permission helpers (based on your image) ----------

    private TeamRole getRoleForProject(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        Long teamId = project.getTeam().getId();
        Long userId = getCurrentUserId();

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

        if (sprint.getStartDate() != null && sprint.getEndDate() != null
                && sprint.getStartDate().isAfter(sprint.getEndDate())) {
            throw new RuntimeException("Start date cannot be after end date");
        }

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

        if (updatedSprint.getName() != null) existing.setName(updatedSprint.getName());
        if (updatedSprint.getStartDate() != null) existing.setStartDate(updatedSprint.getStartDate());
        if (updatedSprint.getEndDate() != null) existing.setEndDate(updatedSprint.getEndDate());
        if (updatedSprint.getStatus() != null) existing.setStatus(updatedSprint.getStatus());
        if (updatedSprint.getGoal() != null) existing.setGoal(updatedSprint.getGoal());

        if (existing.getStartDate() != null && existing.getEndDate() != null
                && existing.getStartDate().isAfter(existing.getEndDate())) {
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

        List<Task> sprintTasks = taskRepository.findBySprintId(id);
        if (!sprintTasks.isEmpty()) {
            for (Task task : sprintTasks) {
                task.setSprint(null);
            }
            taskRepository.saveAll(sprintTasks);
        }

        // Delete associated sprintboard (and its columns via cascade) before deleting sprint
        sprintboardRepository.findBySprintId(id).ifPresent(sprintboardRepository::delete);

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



        sprint.setStartDate(startDate);
        sprint.setEndDate(endDate);
        sprint.setStatus(SprintStatus.ACTIVE);

        Sprint savedSprint = sprintRepository.save(sprint);

        // Auto-create sprintboard for the active sprint
        try {
            sprintboardService.createSprintboardForSprint(savedSprint.getId());
        } catch (Exception e) {
            // Log error but don't fail sprint creation
            System.err.println("Failed to create sprintboard for sprint " + savedSprint.getId() + ": " + e.getMessage());
        }

        return savedSprint;
    }
}
