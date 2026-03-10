package com.planora.backend.service;

import com.planora.backend.dto.SprintboardResponseDTO;
import com.planora.backend.dto.SprintboardTaskResponseDTO;
import com.planora.backend.dto.SprintcolumnDTO;
import com.planora.backend.model.*;
import com.planora.backend.repository.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class SprintboardService {

    private final SprintboardRepository sprintboardRepository;
    private final SpringcolumnRepository springcolumnRepository;
    private final SprintRepository sprintRepository;
    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final SpringcolumnService springcolumnService;

    public SprintboardService(SprintboardRepository sprintboardRepository,
                              SpringcolumnRepository springcolumnRepository,
                              SprintRepository sprintRepository,
                              TaskRepository taskRepository,
                              ProjectRepository projectRepository,
                              TeamMemberRepository teamMemberRepository,
                              UserRepository userRepository,
                              SpringcolumnService springcolumnService) {
        this.sprintboardRepository = sprintboardRepository;
        this.springcolumnRepository = springcolumnRepository;
        this.sprintRepository = sprintRepository;
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.userRepository = userRepository;
        this.springcolumnService = springcolumnService;
    }


    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            throw new RuntimeException("Unauthorized");
        }


        String email = auth.getName();


        User user = userRepository.findByEmail(email);

        if (user == null) {
            throw new RuntimeException("User not found for email: " + email);
        }

        return user.getUserId();
    }

    // ---------- Permission helpers (same as SprintService) ----------

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

    // ---------- Sprintboard APIs ----------

    @Transactional
    public Sprintboard createSprintboardForSprint(Long sprintId) {
        Sprint sprint = sprintRepository.findById(sprintId)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        if (sprintboardRepository.existsBySprintId(sprintId)) {
            throw new RuntimeException("Sprintboard already exists for this sprint");
        }

        Sprintboard sprintboard = new Sprintboard();
        sprintboard.setSprint(sprint);

        Sprintboard savedSprintboard = sprintboardRepository.save(sprintboard);

        // Create default columns
        springcolumnService.initializeColumnsForSprintboard(savedSprintboard);

        return savedSprintboard;
    }

    public SprintboardResponseDTO getSprintboardBySprintId(Long sprintId) {
        Sprint sprint = sprintRepository.findById(sprintId)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        requireViewBoard(sprint.getProId());

        Sprintboard sprintboard = sprintboardRepository.findBySprintId(sprintId)
                .orElseThrow(() -> new RuntimeException("Sprintboard not found for sprint"));

        SprintboardResponseDTO response = new SprintboardResponseDTO();
        response.setId(sprintboard.getId());
        response.setSprintId(sprint.getId());
        response.setSprintName(sprint.getName());
        response.setSprintStatus(sprint.getStatus().toString());
        response.setCreatedAt(sprintboard.getCreatedAt());
        response.setUpdatedAt(sprintboard.getUpdatedAt());

        List<Sprintcolumn> columns = springcolumnRepository.findBySprintboardIdOrderByPosition(sprintboard.getId());
        List<SprintcolumnDTO> columnDTOs = columns.stream()
                .map(col -> {
                    SprintcolumnDTO dto = new SprintcolumnDTO();
                    dto.setId(col.getId());
                    dto.setPosition(col.getPosition());
                    dto.setColumnName(col.getColumnName());
                    dto.setColumnStatus(col.getColumnStatus().toString());
                    return dto;
                })
                .collect(Collectors.toList());

        response.setColumns(columnDTOs);
        return response;
    }

    public Sprintboard getSprintboardById(Long sprintboardId) {
        return sprintboardRepository.findById(sprintboardId)
                .orElseThrow(() -> new RuntimeException("Sprintboard not found"));
    }

    public List<SprintboardTaskResponseDTO> getTasksBySprintColumn(Long sprintboardId, SprintcolumnStatus columnStatus) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireViewBoard(sprint.getProId());

        List<Task> tasks = taskRepository.findByProjectId(sprint.getProId()).stream()
                .filter(task -> task.getSprint() != null && task.getSprint().getId().equals(sprint.getId()))
                .filter(task -> task.getStatus().toString().equals(columnStatus.toString()))
                .collect(Collectors.toList());

        return tasks.stream()
                .map(task -> {
                    SprintboardTaskResponseDTO dto = new SprintboardTaskResponseDTO();
                    dto.setTaskId(task.getId());
                    dto.setTitle(task.getTitle());
                    dto.setStoryPoint(task.getStoryPoint());
                    dto.setStatus(task.getStatus().toString());
                    dto.setPriority(task.getPriority().toString());
                    dto.setDueDate(task.getDueDate());
                    if (task.getAssignee() != null && task.getAssignee().getUser() != null) {
                        dto.setAssigneeName(task.getAssignee().getUser().getFullName());
                    }
                    return dto;
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public void moveTaskToColumn(Long taskId, Long sprintboardId, SprintcolumnStatus newStatus) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireConfigureBoard(sprint.getProId());

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        if (task.getSprint() == null || !task.getSprint().getId().equals(sprint.getId())) {
            throw new RuntimeException("Task is not assigned to this sprint");
        }

        // Update task status to match the column
        Status taskStatus = Status.valueOf(newStatus.toString());
        task.setStatus(taskStatus);

        taskRepository.save(task);
    }

    @Transactional
    public void deleteSprintboard(Long sprintboardId) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireConfigureBoard(sprint.getProId());

        sprintboardRepository.deleteById(sprintboardId);
    }

    public SprintboardResponseDTO getSprintboardBySprintboardId(Long sprintboardId) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireViewBoard(sprint.getProId());

        SprintboardResponseDTO response = new SprintboardResponseDTO();
        response.setId(sprintboard.getId());
        response.setSprintId(sprint.getId());
        response.setSprintName(sprint.getName());
        response.setSprintStatus(sprint.getStatus().toString());
        response.setCreatedAt(sprintboard.getCreatedAt());
        response.setUpdatedAt(sprintboard.getUpdatedAt());

        List<Sprintcolumn> columns = springcolumnRepository.findBySprintboardIdOrderByPosition(sprintboard.getId());
        List<SprintcolumnDTO> columnDTOs = columns.stream()
                .map(col -> {
                    SprintcolumnDTO dto = new SprintcolumnDTO();
                    dto.setId(col.getId());
                    dto.setPosition(col.getPosition());
                    dto.setColumnName(col.getColumnName());
                    dto.setColumnStatus(col.getColumnStatus().toString());
                    return dto;
                })
                .collect(Collectors.toList());

        response.setColumns(columnDTOs);
        return response;
    }
}