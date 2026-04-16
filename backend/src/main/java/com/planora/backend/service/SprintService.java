package com.planora.backend.service;

import com.planora.backend.dto.SprintCreateRequestDTO;
import com.planora.backend.dto.SprintResponseDTO;
import com.planora.backend.exception.ConflictException;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.Project;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.SprintStatus;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.Task;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.SprintboardRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SprintService {

    private static final Logger logger = LoggerFactory.getLogger(SprintService.class);

    private final SprintRepository sprintRepository;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final SprintboardService sprintboardService;
    private final TaskRepository taskRepository;
    private final SprintboardRepository sprintboardRepository;

    public SprintService(SprintRepository sprintRepository,
                         ProjectRepository projectRepository,
                         TeamMemberRepository teamMemberRepository,
                         SprintboardService sprintboardService,
                         TaskRepository taskRepository,
                         SprintboardRepository sprintboardRepository) {
        this.sprintRepository = sprintRepository;
        this.projectRepository = projectRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.sprintboardService = sprintboardService;
        this.taskRepository = taskRepository;
        this.sprintboardRepository = sprintboardRepository;
    }

    // ---------- Permission helpers ----------

    private TeamRole getRoleForProject(Long projectId, Long userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        Long teamId = project.getTeam().getId();

        TeamMember member = teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new ForbiddenException("Access denied: Not a team member"));

        return member.getRole();
    }

    private void requireViewBoard(Long projectId, Long userId) {
        getRoleForProject(projectId, userId);
    }

    private void requireConfigureBoard(Long projectId, Long userId) {
        TeamRole role = getRoleForProject(projectId, userId);
        if (!(role == TeamRole.OWNER || role == TeamRole.ADMIN)) {
            throw new ForbiddenException("Access denied: OWNER/ADMIN required (CONFIGURE_BOARD)");
        }
    }

    // ---------- DTO mapping ----------

    public SprintResponseDTO toDTO(Sprint s) {
        return SprintResponseDTO.builder()
                .id(s.getId())
                .projectId(s.getProId())
                .name(s.getName())
                .startDate(s.getStartDate())
                .endDate(s.getEndDate())
                .status(s.getStatus() != null ? s.getStatus().name() : null)
                .goal(s.getGoal())
                .build();
    }

    private SprintResponseDTO toDTO(Object[] row) {
        return SprintResponseDTO.builder()
                .id((Long) row[0])
                .projectId((Long) row[1])
                .name((String) row[2])
                .startDate((LocalDate) row[3])
                .endDate((LocalDate) row[4])
                .status(row[5] != null ? ((SprintStatus) row[5]).name() : null)
                .goal((String) row[6])
                .build();
    }

    // ---------- Sprint APIs ----------

    @Transactional
    public SprintResponseDTO createSprint(SprintCreateRequestDTO request, Long currentUserId) {
        requireConfigureBoard(request.getProId(), currentUserId);

        if (request.getStartDate() != null && request.getEndDate() != null
                && request.getStartDate().isAfter(request.getEndDate())) {
            throw new IllegalArgumentException("Start date cannot be after end date");
        }

        Project project = projectRepository.findById(request.getProId())
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        Sprint sprint = new Sprint();
        sprint.setProject(project);
        sprint.setName(request.getName());
        sprint.setStartDate(request.getStartDate());
        sprint.setEndDate(request.getEndDate());
        sprint.setGoal(request.getGoal());
        sprint.setStatus(SprintStatus.NOT_STARTED);

        return toDTO(sprintRepository.save(sprint));
    }

    @Transactional(readOnly = true)
    public List<SprintResponseDTO> getSprintsByProject(Long projectId, Long currentUserId) {
        requireViewBoard(projectId, currentUserId);
        return sprintRepository.findSprintRowsByProjectId(projectId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SprintResponseDTO getSprintById(Long id, Long currentUserId) {
        Sprint sprint = sprintRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sprint not found"));
        requireViewBoard(sprint.getProId(), currentUserId);
        return toDTO(sprint);
    }

    /** Internal use by BurndownService — returns entity, no auth check duplication */
    @Transactional(readOnly = true)
    public Sprint getSprintEntityById(Long id) {
        return sprintRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sprint not found"));
    }

    @Transactional
    public SprintResponseDTO updateSprint(Long id, SprintCreateRequestDTO request, Long currentUserId) {
        Sprint existing = sprintRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sprint not found"));

        requireConfigureBoard(existing.getProId(), currentUserId);

        if (request.getName() != null) existing.setName(request.getName());
        if (request.getStartDate() != null) existing.setStartDate(request.getStartDate());
        if (request.getEndDate() != null) existing.setEndDate(request.getEndDate());
        if (request.getGoal() != null) existing.setGoal(request.getGoal());
        if (request.getStatus() != null) {
            try {
                existing.setStatus(SprintStatus.valueOf(request.getStatus()));
            } catch (IllegalArgumentException ignored) {
                // keep existing status if unknown value
            }
        }

        if (existing.getStartDate() != null && existing.getEndDate() != null
                && existing.getStartDate().isAfter(existing.getEndDate())) {
            throw new IllegalArgumentException("Start date cannot be after end date");
        }

        return toDTO(sprintRepository.save(existing));
    }

    @Transactional
    public void deleteSprint(Long id, Long currentUserId) {
        Sprint existing = sprintRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sprint not found"));

        requireConfigureBoard(existing.getProId(), currentUserId);

        List<Task> sprintTasks = taskRepository.findBySprintId(id);
        if (!sprintTasks.isEmpty()) {
            sprintTasks.forEach(task -> task.setSprint(null));
            taskRepository.saveAll(sprintTasks);
        }

        sprintboardRepository.findBySprintId(id).ifPresent(sprintboardRepository::delete);
        sprintRepository.deleteById(id);
    }

    @Transactional
    public SprintResponseDTO startSprint(Long sprintId, LocalDate startDate, LocalDate endDate, Long currentUserId) {
        Sprint sprint = sprintRepository.findById(sprintId)
                .orElseThrow(() -> new ResourceNotFoundException("Sprint not found"));

        requireConfigureBoard(sprint.getProId(), currentUserId);

        if (sprint.getStatus() == SprintStatus.ACTIVE) {
            throw new ConflictException("Sprint is already ACTIVE");
        }
        if (sprint.getStatus() == SprintStatus.COMPLETED) {
            throw new ConflictException("Cannot start a COMPLETED sprint");
        }
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("Start date and end date are required");
        }
        if (startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("Start date cannot be after end date");
        }

        sprint.setStartDate(startDate);
        sprint.setEndDate(endDate);
        sprint.setStatus(SprintStatus.ACTIVE);

        Sprint savedSprint = sprintRepository.save(sprint);

        try {
            sprintboardService.createSprintboardForSprint(savedSprint.getId(), currentUserId);
        } catch (Exception e) {
            logger.error("Failed to create sprintboard for sprint {}: {}", savedSprint.getId(), e.getMessage(), e);
        }

        return toDTO(savedSprint);
    }

    @Transactional
    public SprintResponseDTO completeSprint(Long id, Long currentUserId) {
        Sprint sprint = sprintRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sprint not found"));

        if (sprint.getStatus() != SprintStatus.ACTIVE) {
            throw new ConflictException("Sprint is not ACTIVE");
        }

        requireConfigureBoard(sprint.getProId(), currentUserId);

        sprint.setStatus(SprintStatus.COMPLETED);
        sprintRepository.save(sprint);

        List<Task> incomplete = taskRepository.findBySprintId(id)
                .stream()
                .filter(t -> !"DONE".equalsIgnoreCase(t.getStatus()))
                .collect(Collectors.toList());

        if (!incomplete.isEmpty()) {
            // Find next available NOT_STARTED sprint in the same project
            List<Sprint> nextSprints = sprintRepository.findNextAvailableSprint(
                    sprint.getProId(), SprintStatus.NOT_STARTED, id, PageRequest.of(0, 1)
            );

            Sprint targetSprint = nextSprints.isEmpty() ? null : nextSprints.get(0);
            incomplete.forEach(t -> t.setSprint(targetSprint));
            taskRepository.saveAll(incomplete);
        }

        return toDTO(sprint);
    }
}
