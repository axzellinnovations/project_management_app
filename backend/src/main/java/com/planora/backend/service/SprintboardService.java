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

    private TeamRole getRoleForProject(Long projectId, Long userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        Long teamId = project.getTeam().getId();

        TeamMember member = teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new RuntimeException("Access denied: Not a team member"));

        return member.getRole();
    }

    private void requireViewBoard(Long projectId, Long userId) {
        getRoleForProject(projectId, userId);
    }

    // ---------- Sprintboard APIs ----------

    @Transactional
    public Sprintboard createSprintboardForSprint(Long sprintId) {
        Sprint sprint = sprintRepository.findById(sprintId)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        requireViewBoard(sprint.getProId(), getCurrentUserId());

        if (sprintboardRepository.existsBySprintId(sprintId)) {
            return sprintboardRepository.findBySprintId(sprintId).orElse(null);
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

        requireViewBoard(sprint.getProId(), getCurrentUserId());

        Sprintboard sprintboard = sprintboardRepository.findBySprintId(sprintId)
                .orElseThrow(() -> new RuntimeException("Sprintboard not found for sprint"));

        SprintboardResponseDTO response = new SprintboardResponseDTO();
        response.setId(sprintboard.getId());
        response.setSprintId(sprint.getId());
        response.setSprintName(sprint.getName());
        response.setSprintStatus(sprint.getStatus() != null ? sprint.getStatus().toString() : "NOT_STARTED");
        response.setCreatedAt(sprintboard.getCreatedAt());
        response.setUpdatedAt(sprintboard.getUpdatedAt());

        List<Sprintcolumn> columns = springcolumnRepository.findBySprintboardIdOrderByPosition(sprintboard.getId());
        List<SprintcolumnDTO> columnDTOs = columns.stream()
                .map(col -> {
                    SprintcolumnDTO dto = new SprintcolumnDTO();
                    dto.setId(col.getId());
                    dto.setPosition(col.getPosition());
                    dto.setColumnName(col.getColumnName());
                    dto.setColumnStatus(col.getColumnStatus() != null ? col.getColumnStatus().toString() : "TODO");
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

    @Transactional(readOnly = true)
    public List<SprintboardTaskResponseDTO> getTasksBySprintColumn(Long sprintboardId, SprintcolumnStatus columnStatus) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireViewBoard(sprint.getProId(), getCurrentUserId());

        List<Task> tasks = taskRepository.findByProjectId(sprint.getProId()).stream()
                .filter(task -> task.getSprint() != null && task.getSprint().getId().equals(sprint.getId()))
                .filter(task -> {
                    String status = task.getStatus();
                    return status != null && status.equalsIgnoreCase(columnStatus.toString());
                })
                .collect(Collectors.toList());

        return tasks.stream()
                .map(task -> {
                    SprintboardTaskResponseDTO dto = new SprintboardTaskResponseDTO();
                    dto.setTaskId(task.getId());
                    dto.setTitle(task.getTitle());
                    dto.setStoryPoint(task.getStoryPoint());
                    dto.setStatus(task.getStatus() != null ? task.getStatus() : "TODO");
                    dto.setPriority(task.getPriority() != null ? task.getPriority().toString() : "MEDIUM");
                    dto.setDueDate(task.getDueDate());
                    if (task.getAssignee() != null && task.getAssignee().getUser() != null) {
                        dto.setAssigneeName(task.getAssignee().getUser().getFullName());
                        dto.setAssigneePhotoUrl(task.getAssignee().getUser().getProfilePicUrl());
                    }
                    return dto;
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public void moveTaskToColumn(Long taskId, Long sprintboardId, SprintcolumnStatus newStatus, Long currentUserId) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireViewBoard(sprint.getProId(), currentUserId);

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        if (task.getSprint() == null || !task.getSprint().getId().equals(sprint.getId())) {
            throw new RuntimeException("Task is not assigned to this sprint");
        }

        // Update task status to match the column
        task.setStatus(newStatus.toString());

        taskRepository.save(task);
    }

    @Transactional
    public void deleteSprintboard(Long sprintboardId) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireViewBoard(sprint.getProId(), getCurrentUserId());

        sprintboardRepository.deleteById(sprintboardId);
    }

    @Transactional
    public SprintcolumnDTO addColumnToSprintboard(Long sprintboardId, String name, String statusStr, Long currentUserId) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireViewBoard(sprint.getProId(), currentUserId);

        SprintcolumnStatus status;
        try {
            status = SprintcolumnStatus.valueOf(statusStr.toUpperCase());
        } catch (Exception e) {
            status = SprintcolumnStatus.TODO;
        }

        // Get max position
        List<Sprintcolumn> columns = springcolumnRepository.findBySprintboardIdOrderByPosition(sprintboardId);
        int maxPos = columns.stream()
                .mapToInt(Sprintcolumn::getPosition)
                .max()
                .orElse(-1);

        Sprintcolumn column = new Sprintcolumn();
        column.setSprintboard(sprintboard);
        column.setColumnName(name);
        column.setColumnStatus(status);
        column.setPosition(maxPos + 1);

        Sprintcolumn savedCol = springcolumnRepository.save(column);

        SprintcolumnDTO dto = new SprintcolumnDTO();
        dto.setId(savedCol.getId());
        dto.setColumnName(savedCol.getColumnName());
        dto.setColumnStatus(savedCol.getColumnStatus().toString());
        dto.setPosition(savedCol.getPosition());
        return dto;
    }

    public SprintboardResponseDTO getSprintboardBySprintboardId(Long sprintboardId) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireViewBoard(sprint.getProId(), getCurrentUserId());

        SprintboardResponseDTO response = new SprintboardResponseDTO();
        response.setId(sprintboard.getId());
        response.setSprintId(sprint.getId());
        response.setSprintName(sprint.getName());
        response.setSprintStatus(sprint.getStatus() != null ? sprint.getStatus().toString() : "NOT_STARTED");
        response.setCreatedAt(sprintboard.getCreatedAt());
        response.setUpdatedAt(sprintboard.getUpdatedAt());

        List<Sprintcolumn> columns = springcolumnRepository.findBySprintboardIdOrderByPosition(sprintboard.getId());
        List<SprintcolumnDTO> columnDTOs = columns.stream()
                .map(col -> {
                    SprintcolumnDTO dto = new SprintcolumnDTO();
                    dto.setId(col.getId());
                    dto.setPosition(col.getPosition());
                    dto.setColumnName(col.getColumnName());
                    dto.setColumnStatus(col.getColumnStatus() != null ? col.getColumnStatus().toString() : "TODO");
                    return dto;
                })
                .collect(Collectors.toList());

        response.setColumns(columnDTOs);
        return response;
    }
}