package com.planora.backend.service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.dto.DashboardBoardDTO;
import com.planora.backend.dto.SprintboardResponseDTO;
import com.planora.backend.dto.SprintboardTaskResponseDTO;
import com.planora.backend.dto.SprintcolumnDTO;
import com.planora.backend.model.Project;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.Sprintboard;
import com.planora.backend.model.Sprintcolumn;
import com.planora.backend.model.Task;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SpringcolumnRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.SprintboardRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;

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
    private final NotificationService notificationService;

    public SprintboardService(SprintboardRepository sprintboardRepository,
                              SpringcolumnRepository springcolumnRepository,
                              SprintRepository sprintRepository,
                              TaskRepository taskRepository,
                              ProjectRepository projectRepository,
                              TeamMemberRepository teamMemberRepository,
                              UserRepository userRepository,
                              SpringcolumnService springcolumnService,
                              NotificationService notificationService) {
        this.sprintboardRepository = sprintboardRepository;
        this.springcolumnRepository = springcolumnRepository;
        this.sprintRepository = sprintRepository;
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.userRepository = userRepository;
        this.springcolumnService = springcolumnService;
        this.notificationService = notificationService;
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

    // ---------- Dashboard Boards APIs ----------

    public List<DashboardBoardDTO> getRecentSprintboardsForUser(Long userId, int limit) {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, limit);
        return sprintboardRepository.findRecentSprintboardsForUser(userId, pageable);
    }

    // ---------- Sprintboard APIs ----------

    @Transactional
    public Sprintboard createSprintboardForSprint(Long sprintId, Long currentUserId) {
        Sprint sprint = sprintRepository.findById(sprintId)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        requireViewBoard(sprint.getProId(), currentUserId);

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

    public SprintboardResponseDTO getSprintboardBySprintId(Long sprintId, Long currentUserId) {
        Sprint sprint = sprintRepository.findById(sprintId)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        requireViewBoard(sprint.getProId(), currentUserId);

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
                    dto.setColumnStatus(col.getColumnStatus() != null ? col.getColumnStatus() : "TODO");
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
    public List<SprintboardTaskResponseDTO> getTasksBySprintColumn(Long sprintboardId, String columnStatus, Long currentUserId) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireViewBoard(sprint.getProId(), currentUserId);

        List<Task> tasks = taskRepository.findByProjectId(sprint.getProId()).stream()
                .filter(task -> task.getSprint() != null && task.getSprint().getId().equals(sprint.getId()))
                .filter(task -> {
                    String status = task.getStatus();
                    return status != null && status.equalsIgnoreCase(columnStatus);
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
                    if (task.getLabels() != null && !task.getLabels().isEmpty()) {
                        var label = task.getLabels().iterator().next();
                        dto.setLabelName(label.getName());
                        dto.setLabelColor(label.getColor());
                    }
                    return dto;
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public void moveTaskToColumn(Long taskId, Long sprintboardId, String newStatus, Long currentUserId) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireViewBoard(sprint.getProId(), currentUserId);

        // Use the details query so assignee/reporter are available for notifications
        // and unit tests that mock this repository path remain stable.
        Task task = taskRepository.findByIdWithDetails(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        if (task.getSprint() == null || !task.getSprint().getId().equals(sprint.getId())) {
            throw new RuntimeException("Task is not assigned to this sprint");
        }

        String oldStatus = task.getStatus();
        task.setStatus(newStatus);

        taskRepository.save(task);

        if (oldStatus == null || !oldStatus.equalsIgnoreCase(newStatus)) {
            String actorName = userRepository.findById(currentUserId)
                    .map(User::getUsername)
                    .orElse("Unknown");
            String message = actorName + " moved task \"" + task.getTitle()
                    + "\" from " + (oldStatus != null ? oldStatus : "NONE")
                    + " to " + newStatus;
            notifyTaskStakeholders(task, currentUserId, message);
        }
    }

    private void notifyTaskStakeholders(Task task, Long actorUserId, String message) {
        Set<Long> recipientIds = new LinkedHashSet<>();

        if (task.getAssignee() != null && task.getAssignee().getUser() != null) {
            recipientIds.add(task.getAssignee().getUser().getUserId());
        }
        if (task.getReporter() != null && task.getReporter().getUser() != null) {
            recipientIds.add(task.getReporter().getUser().getUserId());
        }

        recipientIds.remove(actorUserId);
        if (recipientIds.isEmpty()) {
            return;
        }

        String link = "/taskcard?taskId=" + task.getId();
        userRepository.findAllById(recipientIds)
                .forEach(user -> notificationService.createNotification(user, message, link));
    }

    @Transactional
    public void deleteSprintboard(Long sprintboardId, Long currentUserId) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireViewBoard(sprint.getProId(), currentUserId);

        sprintboardRepository.deleteById(sprintboardId);
    }

    @Transactional
    public SprintcolumnDTO addColumnToSprintboard(Long sprintboardId, String name, String statusStr, Long currentUserId) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireViewBoard(sprint.getProId(), currentUserId);

        String status = (statusStr != null && !statusStr.isBlank())
                ? statusStr.trim().toUpperCase().replaceAll("[^A-Z0-9]+", "_")
                : "TODO";

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
        dto.setColumnStatus(savedCol.getColumnStatus());
        dto.setPosition(savedCol.getPosition());
        return dto;
    }

    public SprintboardResponseDTO getSprintboardBySprintboardId(Long sprintboardId, Long currentUserId) {
        Sprintboard sprintboard = getSprintboardById(sprintboardId);
        Sprint sprint = sprintboard.getSprint();

        requireViewBoard(sprint.getProId(), currentUserId);

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
                    dto.setColumnStatus(col.getColumnStatus() != null ? col.getColumnStatus() : "TODO");
                    return dto;
                })
                .collect(Collectors.toList());

        response.setColumns(columnDTOs);
        return response;
    }
}