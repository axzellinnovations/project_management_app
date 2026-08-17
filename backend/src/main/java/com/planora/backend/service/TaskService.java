package com.planora.backend.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Objects;
import java.util.Queue;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.dto.CommentRequestDTO;
import com.planora.backend.dto.TaskGithubSummaryDTO;
import com.planora.backend.dto.TaskRequestDTO;
import com.planora.backend.dto.TaskResponseDTO;
import com.planora.backend.dto.TaskResponseDTO.DependencyDTO;
import com.planora.backend.dto.TaskResponseDTO.SubtaskDTO;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.Comment;
import com.planora.backend.model.Kanban;
import com.planora.backend.model.KanbanColumn;
import com.planora.backend.model.Label;
import com.planora.backend.model.Milestone;
import com.planora.backend.model.Priority;
import com.planora.backend.model.Project;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskActivityType;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.CommentRepository;
import com.planora.backend.repository.KanbanColumnRepository;
import com.planora.backend.repository.KanbanRepository;
import com.planora.backend.repository.LabelRepository;
import com.planora.backend.repository.MilestoneRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TaskAccessRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/*
 * Handles the complete lifecycle of tasks, including Agile metrics (sprints, story points),
 * complex relationships (dependencies, subtasks), and strict Role-Based Access Control.
 */
@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;

    private final KanbanColumnRepository kanbanColumnRepository;

    private final KanbanRepository kanbanRepository;

    private final ProjectRepository projectRepository;

    private final UserRepository userRepository;

    private final LabelRepository labelRepository;

    private final CommentRepository commentRepository;

    private final SprintRepository sprintRepository;

    private final NotificationService notificationService;

    private final TaskAccessRepository taskAccessRepository;

    private final TaskActivityService taskActivityService;

    private final MilestoneRepository milestoneRepository;

    private final UserService userService;

    public static final List<String> ALLOWED_SORT_FIELDS = List.of(
            "createdAt",
            "updatedAt",
            "dueDate",
            "priority",
            "status",
            "title",
            "projectTaskNumber"
    );

    public static boolean isAllowedTaskSortField(String sortBy) {
        return sortBy != null && ALLOWED_SORT_FIELDS.contains(sortBy);
    }

    public static boolean isAllowedTaskSortDirection(String sortDir) {
        return sortDir != null && ("asc".equalsIgnoreCase(sortDir) || "desc".equalsIgnoreCase(sortDir));
    }

    private final TeamMembershipLookupService teamMembershipLookupService;

    private final TaskGithubService taskGithubService;

    private final SimpMessagingTemplate messagingTemplate;

    // ── 1. CREATE TASK ──────────────────────────────────────────────────────────

    // Creates a new task and intelligently places it in either a Sprint or the general Backlog.
    @Transactional
    public TaskResponseDTO createTask(TaskRequestDTO request, Long currentUserId) {
        // Step 1. Validate the parent project exists.
        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(()-> new ResourceNotFoundException("Project not found"));

        // Step 2. Security Check: Only active team members can create tasks. Viewers cannot.
        requireMinimumRole(project.getTeam().getId(), currentUserId, TeamRole.MEMBER);

        // Step 3. Initialize the core task entity.
        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        task.setProject(project);

        // Step 4. Generate a human-readable task ID (e.g., PLAN-124).
        // Serialize the MAX + 1 allocation per project. Without this lock, two
        // concurrent requests can both observe the same maximum and one loses at
        // the database unique constraint instead of receiving the next number.
        projectRepository.findByIdWithLock(project.getId());
        task.setProjectTaskNumber(taskRepository.findMaxProjectTaskNumberByProjectId(project.getId()) + 1L);

        task.setStoryPoint(request.getStoryPoint() != null ? request.getStoryPoint() : 0);

        task.setStartDate(request.getStartDate());
        task.setDueDate(request.getDueDate());

        //enum assign
        if(request.getPriority() != null) task.setPriority(Priority.valueOf(request.getPriority()));
        if(request.getStatus() != null) task.setStatus(request.getStatus());

        // Step 5. Kanban vs Scrum logic: Is this going into a specific Sprint or the Backlog?
        if(request.getSprintId() != null){
            Sprint sprint = sprintRepository.findById(request.getSprintId())
                    .orElseThrow(()-> new ResourceNotFoundException("Sprint not found"));
            task.setSprint(sprint);
            // Append to the bottom of the Sprint board.
            projectRepository.findByIdWithLock(project.getId()); // serialise concurrent position assignments
            task.setSprintPosition(taskRepository.findMaxSprintPositionBySprintId(sprint.getId()) + 1);
            task.setBacklogPosition(null);
        } else {
            // Append to the bottom of the Backlog.
            projectRepository.findByIdWithLock(project.getId()); // serialise concurrent position assignments
            task.setBacklogPosition(taskRepository.findMaxBacklogPositionByProjectId(project.getId()) + 1);
            task.setSprintPosition(null);
        }

        if (request.getMilestoneId() != null) {
            task.setMilestone(resolveMilestoneForProject(project.getId(), request.getMilestoneId()));
        }

        // Step 6. Attach any requested tags/labels.
        if (request.getLabelIds() != null && !request.getLabelIds().isEmpty()) {
            for (Long labelId : request.getLabelIds()) {
                labelRepository.findById(labelId).ifPresent(label -> task.getLabels().add(label));
            }
        }

        //validate and assign users
        Long teamId = project.getTeam().getId();

        // Step 7. Handle Assignees (Supporting legacy single-assignee and V4 multi-assignee).
        if(request.getAssigneeId() != null){
            task.setAssignee(validateTeamMember(teamId, request.getAssigneeId()));
        }

        // handle multiple assignees
        if (request.getAssigneeIds() != null && !request.getAssigneeIds().isEmpty()) {
            for (Long aid : request.getAssigneeIds()) {
                task.getAssignees().add(validateTeamMember(teamId, aid));
            }

            // Set primary assignee for backwards compatibility with older clients.
            if (task.getAssignee() == null && !task.getAssignees().isEmpty()) {
                task.setAssignee(task.getAssignees().iterator().next());
            }
        }

        // Default reporter is the person hitting the endpoint.
        task.setReporter(validateTeamMember(teamId, currentUserId));

        // Set last modified by
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());

        // Step 8. Recurring tasks logic. Computes the next time this task should pop up.
        if (request.getRecurrenceRule() != null) {
            task.setRecurrenceRule(request.getRecurrenceRule());
            task.setRecurrenceEnd(request.getRecurrenceEnd());
            task.setRecurrenceActive(request.getRecurrenceActive() != null ? request.getRecurrenceActive() : true);
            task.setCustomInterval(request.getCustomInterval());
            task.setRecurrenceLimit(request.getRecurrenceLimit());
            task.setNextOccurrence(computeNextOccurrence(task.getDueDate(), request.getRecurrenceRule(), request.getCustomInterval()));
        }

        Task savedTask = taskRepository.save(task);

        // Step 9. Log the activity for the audit trail / project timeline.
        String actorName = savedTask.getReporter() != null
                ? savedTask.getReporter().getUser().getUsername()
                : "System";
        taskActivityService.logActivity(savedTask.getId(), TaskActivityType.TASK_CREATED,
                actorName, "Task created: " + savedTask.getTitle());

        // Step 10. Notify the assigned user (unless the creator assigned it to themselves).
        if (task.getAssignee() != null && !task.getAssignee().getUser().getUserId().equals(currentUserId)) {
            String message = "You were assigned to a new task: " + task.getTitle();
            String link = "/taskcard?taskId=" + savedTask.getId();
            notificationService.createNotification(task.getAssignee().getUser(), message, link);
        }

        // The saved entity already contains every relationship populated during creation.
        // Re-querying it with the large fetch-join graph in the same persistence context
        // can trigger a Hibernate EntityInitializer failure immediately after INSERT.
        // Map the managed entity directly and only load the lightweight dependency rows.
        return mapToDTO(savedTask, buildDependencyMap(List.of(savedTask.getId())));

    }

    @Transactional
    public Task createAutomationTask(Project project, String title, String description, Priority priority) {
        if (project == null || project.getId() == null) {
            throw new ResourceNotFoundException("Project not found");
        }

        Task task = new Task();
        task.setTitle(title);
        task.setDescription(description);
        task.setProject(project);
        projectRepository.findByIdWithLock(project.getId());
        task.setProjectTaskNumber(taskRepository.findMaxProjectTaskNumberByProjectId(project.getId()) + 1L);
        task.setStoryPoint(0);
        task.setPriority(priority != null ? priority : Priority.HIGH);

        if (project.getOwner() != null) {
            task.setLastModifiedBy(project.getOwner());
            if (project.getTeam() != null) {
                TeamMember reporter = teamMembershipLookupService.getTeamMember(
                        project.getTeam().getId(), project.getOwner().getUserId());
                if (reporter != null) {
                    task.setReporter(reporter);
                }
            }
        }

        List<Kanban> kanbans = kanbanRepository.findByProjectId(project.getId());
        if (!kanbans.isEmpty()) {
            List<KanbanColumn> columns = kanbanColumnRepository.findByKanbanIdOrderByPosition(kanbans.get(0).getId());
            if (!columns.isEmpty()) {
                KanbanColumn firstColumn = columns.get(0);
                task.setKanbanColumn(firstColumn);
                task.setStatus(firstColumn.getStatus());
                task.setBacklogPosition(null);
                task.setSprintPosition(null);
                return taskRepository.save(task);
            }
        }

        task.setBacklogPosition(taskRepository.findMaxBacklogPositionByProjectId(project.getId()) + 1);
        task.setSprintPosition(null);
        return taskRepository.save(task);
    }

    // ── 2. GET TASK BY ID ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public TaskResponseDTO getTaskById(Long taskId, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);
        Long teamId = task.getProject().getTeam().getId();
        // Task read policy: any team member, including viewers, may read task data.
        requireMinimumRole(teamId, currentUserId, null);
        return getTaskByIdInternal(taskId);
    }

    private TaskResponseDTO getTaskByIdInternal(Long taskId) {
        // Uses a custom @Query to eagerly fetch details and prevent N+1 query performance issues.
        Task task = taskRepository.findByIdFullyFetched(taskId)
                .orElseThrow(()-> new ResourceNotFoundException("Task not found"));
        return mapToDTO(task, buildDependencyMap(List.of(taskId)));
    }

    /**
     * Enriched overload: syncs fresh GitHub data (PRs, commits, CI status) via
     * TaskGithubService, then returns a TaskResponseDTO with all GitHub fields populated.
     * Falls back to the base getTaskById behaviour when either argument is null/blank.
     *
     * @param repoFullName "owner/repo" of the connected GitHub repository
     * @param githubToken  per-user GitHub OAuth or PAT token from the request header
    */
    @Transactional
    public TaskResponseDTO getTaskById(Long taskId, String repoFullName, String githubToken,
                                       Long currentUserId) {
        Task membershipTask = findTaskWithProjectTeam(taskId);
        Long teamId = membershipTask.getProject().getTeam().getId();
        // Task read policy: any team member, including viewers, may read task data.
        requireMinimumRole(teamId, currentUserId, null);
        Task task = taskRepository.findByIdFullyFetched(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        TaskGithubSummaryDTO githubSummary = taskGithubService.syncAndGetSummary(
                taskId, repoFullName, githubToken, currentUserId);
        return mapToDTO(task, buildDependencyMap(List.of(taskId)), githubSummary);
    }

    // ── 3. UPDATE TASK ──────────────────────────────────────────────────────────

    @Transactional
    public TaskResponseDTO updateTask(Long taskId, TaskRequestDTO request, Long currentUserId) {
        Task task = taskRepository.findByIdForUpdate(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        Long teamId = task.getProject().getTeam().getId();

        //validate permission
        requireMinimumRole(teamId, currentUserId, TeamRole.MEMBER);

        // Step 1. Snapshot the old state so we can detect what actually changed for activity logging.
        String oldStatus = task.getStatus();
        Priority oldPriority = task.getPriority();

        // Step 2. Apply basic text updates.
        if(request.getTitle() != null) task.setTitle(request.getTitle());
        if(request.getDescription() != null) task.setDescription(request.getDescription());
        if(request.getPriority() != null) task.setPriority(Priority.valueOf(request.getPriority()));
        if(request.getStatus() != null) task.setStatus(request.getStatus());

        // Step 3. Automation: If they moved it to DONE, stamp the completion time.
        // If they moved it out of DONE (re-opened it), clear the timestamp.
        if (request.getStatus() != null && !request.getStatus().equalsIgnoreCase(oldStatus)) {
            if ("DONE".equalsIgnoreCase(request.getStatus())) {
                task.setCompletedAt(LocalDateTime.now());
            } else {
                task.setCompletedAt(null);
            }
        }
        if(request.getStoryPoint() != null) task.setStoryPoint(request.getStoryPoint());
        if(request.getStartDate() != null) task.setStartDate(request.getStartDate());
        if(request.getDueDate() != null) task.setDueDate(request.getDueDate());


        // Step 4. Handle moving the task between Sprints and Backlog.
        if(request.isSprintIdProvided()){
            if (request.getSprintId() == null) {
                // Sent to Backlog
                task.setSprint(null);
                task.setSprintPosition(null);
                projectRepository.findByIdWithLock(task.getProject().getId()); // serialise concurrent position assignments
                task.setBacklogPosition(taskRepository.findMaxBacklogPositionByProjectId(task.getProject().getId()) + 1);
            } else {
                // Sent to a new Sprint
                Sprint sprint = sprintRepository.findById(request.getSprintId())
                        .orElseThrow(()->new ResourceNotFoundException("Sprint not found"));
                task.setSprint(sprint);
                task.setBacklogPosition(null);
                projectRepository.findByIdWithLock(task.getProject().getId()); // serialise concurrent position assignments
                task.setSprintPosition(taskRepository.findMaxSprintPositionBySprintId(sprint.getId()) + 1);
            }
        }

        // update milestone
        if (request.isMilestoneIdProvided()) {
            if (request.getMilestoneId() == null) {
                task.setMilestone(null);
            } else {
                task.setMilestone(resolveMilestoneForProject(task.getProject().getId(), request.getMilestoneId()));
            }
        }

        //update reporter — restricted to ADMIN and OWNER
        if(request.getReporterId() != null){
            requireMinimumRole(teamId, currentUserId, TeamRole.ADMIN);
            TeamMember newReporter= validateTeamMember(teamId, request.getReporterId());
            task.setReporter(newReporter);
        }

        // Step 5. Completely replace the assignee list if new ones are provided.
        if (request.getAssigneeIds() != null) {
            task.getAssignees().clear();
            for (Long aid : request.getAssigneeIds()) {
                task.getAssignees().add(validateTeamMember(teamId, aid));
            }
            task.setAssignee(task.getAssignees().isEmpty() ? null : task.getAssignees().iterator().next());
        }

        // update recurrence (V7)
        if (request.getRecurrenceRule() != null) {
            if (request.getRecurrenceRule().trim().isEmpty() || "NONE".equalsIgnoreCase(request.getRecurrenceRule())) {
                task.setRecurrenceRule(null);
                task.setRecurrenceEnd(null);
                task.setNextOccurrence(null);
                task.setCustomInterval(null);
                task.setRecurrenceLimit(null);
                task.setRecurrenceActive(false);
            } else {
                task.setRecurrenceRule(request.getRecurrenceRule());
                task.setRecurrenceEnd(request.getRecurrenceEnd());
                if (request.getRecurrenceActive() != null) {
                    task.setRecurrenceActive(request.getRecurrenceActive());
                }
                task.setCustomInterval(request.getCustomInterval());
                task.setRecurrenceLimit(request.getRecurrenceLimit());
                task.setNextOccurrence(computeNextOccurrence(task.getDueDate(), request.getRecurrenceRule(), request.getCustomInterval()));
            }
        } else if (request.getRecurrenceActive() != null) {
            task.setRecurrenceActive(request.getRecurrenceActive());
        }

        // Handle archiving/unarchiving
        if (request.getArchived() != null) {
            if (request.getArchived() != task.isArchived()) {
                task.setArchived(request.getArchived());
                User actor = userRepository.findById(currentUserId).orElseThrow();
                task.setLastModifiedBy(actor);
                if (request.getArchived()) {
                    task.setArchivedAt(LocalDateTime.now());
                    taskActivityService.logActivity(
                            taskId,
                            TaskActivityType.UPDATED,
                            actor.getUsername(),
                            "Task archived");
                } else {
                    task.setArchivedAt(null);
                    taskActivityService.logActivity(
                            taskId,
                            TaskActivityType.UPDATED,
                            actor.getUsername(),
                            "Task unarchived");
                }
            }
        }

        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
    Task saved = taskRepository.save(task);

        // Step 6. Trigger specific notifications based on the delta (what changed).
        User actor = userRepository.findById(currentUserId)
                .orElse(null);
        String actorName = actor != null ? actor.getUsername() : "Unknown";
        String taskLink = "/taskcard?taskId=" + saved.getId();

        if (request.getStatus() != null && !request.getStatus().equals(oldStatus)) {
            taskActivityService.logActivity(saved.getId(), TaskActivityType.STATUS_CHANGED,
                    actorName, "Status changed from " + oldStatus + " to " + request.getStatus());

            String fromStatus = oldStatus != null ? oldStatus : "NONE";
            String message = actorName + " changed task status for \"" + saved.getTitle()
                + "\" from " + fromStatus + " to " + request.getStatus();
            notifyTaskStakeholders(saved, currentUserId, message, taskLink);
        }
        if (request.getPriority() != null) {
            String oldPriorityName = oldPriority != null ? oldPriority.name() : "NONE";
            if (!request.getPriority().equals(oldPriorityName)) {
                taskActivityService.logActivity(saved.getId(), TaskActivityType.PRIORITY_CHANGED,
                        actorName, "Priority changed from " + oldPriorityName + " to " + request.getPriority());

            String message = actorName + " changed task priority for \"" + saved.getTitle()
                + "\" from " + oldPriorityName + " to " + request.getPriority();
            notifyTaskStakeholders(saved, currentUserId, message, taskLink);
            }
        }
        return getTaskByIdInternal(saved.getId());
    }

    /** * Lightweight date-only update.
     * WHY: Used heavily by frontend Calendar/Gantt chart drag-and-drop features
     * where sending a full TaskRequestDTO is overkill.
     */
    @Transactional
    public TaskResponseDTO patchTaskDates(
            Long taskId,
            LocalDate startDate,
            boolean startDateProvided,
            LocalDate dueDate,
            boolean dueDateProvided,
            Long currentUserId
    ) {
        Task task = findTaskWithProjectTeam(taskId);
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);
        if (startDateProvided) task.setStartDate(startDate);
        if (dueDateProvided) task.setDueDate(dueDate);
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
        Task saved = taskRepository.save(task);
        return getTaskByIdInternal(saved.getId());
    }

    // ── 4. DELETE TASK ──────────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public Long deleteTask(Long taskId, Long currentUserId) {
        Task task = taskRepository.findByIdWithDetails(taskId)
                .orElseThrow(()-> new ResourceNotFoundException("Task not found"));

        //validate user - OWNER or ADMIN only
        Long teamId = task.getProject().getTeam().getId();
        Long projectId = task.getProject().getId();
        Integer deletedBacklogPos = task.getBacklogPosition();
        Integer deletedSprintPos = task.getSprintPosition();
        Long sprintId = task.getSprint() != null ? task.getSprint().getId() : null;

        // Step 1. Hard Security Check: Only Owners or Admins can destroy data.
        TeamMember member = requireMinimumRole(teamId, currentUserId, null);

        if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.ADMIN) {
            throw new ForbiddenException("Access Denied: Only Project Owners or Admins can delete tasks.");
        }

        // Step 2. Collect notification data BEFORE delete.
        // If we try to read `task.getAssignee()` after `taskRepository.delete()`,
        // Hibernate might throw a LazyInitializationException.
        String actorName = userRepository.findById(currentUserId)
                .map(User::getUsername)
                .orElse("Unknown");
        String message = actorName + " deleted task: " + task.getTitle();
        String taskLink = "/kanban?projectId=" + projectId;

        // Collect recipient ids (assignee + reporter, excluding actor)
        Set<Long> recipientIds = new LinkedHashSet<>();
        if (task.getAssignee() != null && task.getAssignee().getUser() != null) {
            recipientIds.add(task.getAssignee().getUser().getUserId());
        }
        if (task.getReporter() != null && task.getReporter().getUser() != null) {
            recipientIds.add(task.getReporter().getUser().getUserId());
        }
        recipientIds.remove(currentUserId);
        List<User> recipients = recipientIds.isEmpty()
                ? List.of()
                : userRepository.findAllById(recipientIds);

        // Step 3. Delete the task so a failure here prevents ghost notifications.
        taskRepository.delete(task);

        // Step 4. Compact list positions after the deleted row is gone.
        if (deletedBacklogPos != null && sprintId == null) {
            taskRepository.compactBacklogPositions(projectId, deletedBacklogPos);
        }
        if (deletedSprintPos != null && sprintId != null) {
            taskRepository.compactSprintPositions(sprintId, deletedSprintPos);
        }

        // Step 5. Send out the alerts.
        for (User recipient : recipients) {
            notificationService.createNotification(recipient, message, taskLink);
        }

        return projectId;
    }

    // ── 5. GET TASKS BY PROJECT (Highly Optimized Fetch) ────────────────────────
    @Transactional(readOnly = true)
    public Page<TaskResponseDTO> getTasksByProject(Long projectId, Long currentUserId, Pageable pageable) {
        return getTasksByProject(projectId, currentUserId, pageable, false);
    }

    @Transactional(readOnly = true)
    public Page<TaskResponseDTO> getTasksByProject(Long projectId, Long currentUserId, Pageable pageable, Boolean archived) {
        validateTaskSort(pageable.getSort());

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        requireMinimumRole(project.getTeam().getId(), currentUserId, null);

        boolean isArchived = archived != null && archived;
        Page<Task> taskPage = taskRepository.findByProjectIdAndArchived(projectId, isArchived, pageable);
        if (taskPage.isEmpty()) {
            return taskPage.map(t -> mapToDTO(t, java.util.Map.of()));
        }

        List<Long> ids = taskPage.getContent().stream().map(Task::getId).toList();
        List<Task> enriched = taskRepository.findByIdInWithCollections(ids);
        java.util.Map<Long, List<DependencyDTO>> dependencyMap = buildDependencyMap(ids);
        java.util.Map<Long, Task> enrichedMap = enriched.stream()
                .collect(java.util.stream.Collectors.toMap(Task::getId, t -> t, (t1, t2) -> t1));

        return taskPage.map(t -> mapToDTO(enrichedMap.getOrDefault(t.getId(), t), dependencyMap));
    }

    private void validateTaskSort(Sort sort) {
        for (Sort.Order order : sort) {
            String property = order.getProperty();
            if (!isAllowedTaskSortField(property)) {
                throw new IllegalArgumentException(
                        "Invalid task sort field '" + property + "'. Allowed values: " + String.join(", ", ALLOWED_SORT_FIELDS));
            }
        }
    }

    @Transactional(readOnly = true)
    public List<TaskResponseDTO> getTasksByProject(Long projectId, Long currentUserId,
                                                   String status, Long assigneeId,
                                                   String priority, Long sprintId, Long milestoneId) {
        return getTasksByProject(projectId, currentUserId, status, assigneeId, priority, sprintId, milestoneId, false);
    }

    @Transactional(readOnly = true)
    public List<TaskResponseDTO> getTasksByProject(Long projectId, Long currentUserId,
                                                   String status, Long assigneeId,
                                                   String priority, Long sprintId, Long milestoneId,
                                                   Boolean archived) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        requireMinimumRole(project.getTeam().getId(), currentUserId, null);

        boolean isArchived = archived != null && archived;
        boolean hasFilters = status != null || assigneeId != null || priority != null || sprintId != null || milestoneId != null;
        if (hasFilters) {
            List<Task> filteredTasks = taskRepository.findByProjectIdFilteredAndArchived(projectId, status, assigneeId, priority, sprintId, milestoneId, isArchived)
                    .stream()
                    .distinct()
                    .toList();
            if (filteredTasks.isEmpty()) {
                return List.of();
            }
            List<Long> ids = filteredTasks.stream().map(Task::getId).toList();
            List<Task> enriched = taskRepository.findByIdInWithCollections(ids);
            java.util.Map<Long, List<DependencyDTO>> dependencyMap = buildDependencyMap(ids);
            java.util.Map<Long, Task> enrichedMap = enriched.stream()
                    .collect(java.util.stream.Collectors.toMap(Task::getId, t -> t, (t1, t2) -> t1));
            return filteredTasks.stream()
                    .map(t -> mapToDTO(enrichedMap.getOrDefault(t.getId(), t), dependencyMap))
                    .collect(Collectors.toList());
        }

        // Standard fetch
        List<Task> tasks = taskRepository.findByProjectIdWithScalarsAndArchived(projectId, isArchived);
        if (tasks.isEmpty()) return List.of();
        List<Long> ids = tasks.stream().map(Task::getId).collect(Collectors.toList());
        List<Task> enriched = taskRepository.findByIdInWithCollections(ids);
        java.util.Map<Long, List<DependencyDTO>> dependencyMap = buildDependencyMap(ids);
        java.util.Map<Long, Task> enrichedMap = enriched.stream()
                .collect(java.util.stream.Collectors.toMap(Task::getId, t -> t, (t1, t2) -> t1));
        return tasks.stream()
                .map(t -> mapToDTO(enrichedMap.getOrDefault(t.getId(), t), dependencyMap))
                .collect(Collectors.toList());
    }

    @Transactional
    public TaskResponseDTO archiveTask(Long taskId, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);
        if (task.isArchived()) {
            return getTaskByIdInternal(taskId);
        }

        User actor = userRepository.findById(currentUserId).orElseThrow();
        task.setArchived(true);
        task.setArchivedAt(LocalDateTime.now());
        task.setLastModifiedBy(actor);
        taskRepository.save(task);

        taskActivityService.logActivity(
                taskId,
                TaskActivityType.UPDATED,
                actor.getUsername(),
                "Task archived");
        return getTaskByIdInternal(taskId);
    }

    @Transactional
    public TaskResponseDTO unarchiveTask(Long taskId, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);

        User actor = userRepository.findById(currentUserId).orElseThrow();
        task.setArchived(false);
        task.setArchivedAt(null);
        task.setLastModifiedBy(actor);
        taskRepository.save(task);

        taskActivityService.logActivity(
                taskId,
                TaskActivityType.UPDATED,
                actor.getUsername(),
                "Task unarchived");
        return getTaskByIdInternal(taskId);
    }

    @Transactional(readOnly = true)
    public List<TaskResponseDTO> getArchivedTasks(Long projectId, Long currentUserId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        requireMinimumRole(project.getTeam().getId(), currentUserId, TeamRole.MEMBER);
        return taskRepository.findArchivedByProjectId(projectId).stream()
                .map(task -> getTaskByIdInternal(task.getId()))
                .collect(Collectors.toList());
    }

    // ── 6. CREATE SUB TASK ──────────────────────────────────────────────────────

    @Transactional
    public TaskResponseDTO createSubTask(Long parentId, TaskRequestDTO subTaskRequest, Long currentUserId) {
        Task parent = findTaskWithProjectTeam(parentId);

        //permission check
        requireMinimumRole(parent.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);

        // Step 1. Trick: We reuse our massive createTask logic, but pass it the parent's project ID.
        subTaskRequest.setProjectId(parent.getProject().getId());
        TaskResponseDTO childDTO = createTask(subTaskRequest, currentUserId);

        // Step 2. Manually forge the link between parent and child.
        Task child = taskRepository.findById(childDTO.getId()).orElseThrow();
        child.setParentTask(parent);
        Task savedChild = taskRepository.save(child);

        // Step 3. Log it on the parent's activity timeline.
        User actor = userRepository.findById(currentUserId).orElse(null);
        String actorName = actor != null ? actor.getUsername() : "Unknown";
        taskActivityService.logActivity(parentId, TaskActivityType.SUBTASK_ADDED,
                actorName, actorName + " added subtask: " + savedChild.getTitle());

        return getTaskByIdInternal(savedChild.getId());
    }

    // ── 7 & 8. DEPENDENCIES ─────────────────────────────────────────────────────

    @Transactional
    public void addDependency(Long taskId, Long blockerId, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);

        // Circular logic prevention.
        if (taskId.equals(blockerId)) {
            throw new IllegalArgumentException("A task cannot depend on itself");
        }

        Task blocker = findTaskWithProjectTeam(blockerId);

        // Prevent dependency across inaccessible projects
        requireMinimumRole(blocker.getProject().getTeam().getId(), currentUserId, null);

        // Check: would adding (taskId -> blockerId) create a cycle?
        // i.e., is taskId already reachable from blockerId through existing dependencies?
        if (wouldCreateCycle(blockerId, taskId)) {
            throw new IllegalArgumentException(
                    "Adding this dependency would create a circular dependency chain."
            );
        }

        task.getDependencies().add(blocker);
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
        taskRepository.save(task);
    }

    /**
     * BFS traversal from startTaskId following dependency edges.
     * Returns true if targetTaskId is reachable, meaning adding an edge from
     * targetTaskId to startTaskId would create a cycle.
     */
    private boolean wouldCreateCycle(Long startTaskId, Long targetTaskId) {
        Queue<Long> queue = new LinkedList<>();
        Set<Long> visited = new HashSet<>();
        queue.add(startTaskId);

        while (!queue.isEmpty()) {
            Long current = queue.poll();
            if (current.equals(targetTaskId)) {
                return true;
            }

            if (visited.contains(current)) {
                continue;
            }
            visited.add(current);

            taskRepository.findByIdWithDependencies(current).ifPresent(t ->
                    t.getDependencies().forEach(dep -> queue.add(dep.getId()))
            );
        }

        return false;
    }

    //8. REMOVE DEPENDENCY
    @Transactional
    public void removeDependency(Long taskId, Long blockerId, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);

        Task blocker = findTaskWithProjectTeam(blockerId);
        task.getDependencies().remove(blocker);
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
        taskRepository.save(task);
    }

    // ── 9 & 10. LABELS ──────────────────────────────────────────────────────────

    //9. ADD LABEL
    @Transactional
    public void addLabel(Long taskId, Long labelId, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);

        Label label = labelRepository.findById(labelId)
                .orElseThrow(() -> new ResourceNotFoundException("Label not found"));
        task.getLabels().add(label);
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
        taskRepository.save(task);
    }

    //10. REMOVE LABEL
    @Transactional
    public void removeLabel(Long taskId, Long labelId, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);

        Label label = labelRepository.findById(labelId)
                .orElseThrow(() -> new ResourceNotFoundException("Label not found"));
        task.getLabels().remove(label);
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
        taskRepository.save(task);
    }

    // ── 11. COMMENTS ────────────────────────────────────────────────────────────

    @Transactional
    public void addComment(Long taskId, CommentRequestDTO request, Long currentUserId) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        User author = userRepository.findById(currentUserId).orElseThrow();

        Comment comment = new Comment();
        comment.setContent(request.getContent());
        comment.setTask(task);
        comment.setAuthor(author);

        commentRepository.save(comment);

        task.setLastModifiedBy(author);
        taskRepository.save(task);

        // Generate a clean preview string for the audit log
        String preview = request.getContent().length() > 60
                ? request.getContent().substring(0, 60) + "…"
                : request.getContent();
        taskActivityService.logActivity(taskId, TaskActivityType.COMMENT_ADDED,
                author.getUsername(), author.getUsername() + " commented: " + preview);

        // Broadcast real-time event so open task cards refresh their comment list.
        // We do NOT include the comment body in the payload to avoid unescaped HTML over WebSocket.
        messagingTemplate.convertAndSend(
                "/topic/project/" + task.getProject().getId() + "/tasks",
                java.util.Map.of(
                    "type", "TASK_COMMENT_ADDED",
                    "taskId", task.getId(),
                    "projectId", task.getProject().getId()
                ));

        // Alert stakeholders, making sure we don't send a notification to the person
        // who actually wrote the comment.
        Set<Long> recipientIds = new LinkedHashSet<>();

        if (task.getAssignee() != null && task.getAssignee().getUser() != null) {
            recipientIds.add(task.getAssignee().getUser().getUserId());
        }
        if (task.getReporter() != null && task.getReporter().getUser() != null) {
            recipientIds.add(task.getReporter().getUser().getUserId());
        }

        recipientIds.remove(currentUserId);
        if (!recipientIds.isEmpty()) {
            String message = author.getUsername() + " commented on task: " + task.getTitle();
            String link = "/taskcard?taskId=" + task.getId();
            userRepository.findAllById(recipientIds)
                    .forEach(recipient -> notificationService.createNotification(recipient, message, link));
        }
    }

    @Transactional(readOnly = true)
    public List<com.planora.backend.dto.CommentResponseDTO> getComments(Long taskId, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);
        Long teamId = task.getProject().getTeam().getId();
        // Task read policy: any team member, including viewers, may read task data.
        requireMinimumRole(teamId, currentUserId, null);
        
        return commentRepository.findByTaskOrderByCreatedAtAsc(task).stream()
                .map(c -> com.planora.backend.dto.CommentResponseDTO.builder()
                        .id(c.getId())
                        .text(c.getContent())
                        .authorName(c.getAuthor().getUsername())
                        .createdAt(c.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    // ── 12. ASSIGNEE MANAGEMENT ─────────────────────────────────────────────────

    @Transactional
    public void assignUser(Long taskId, Long userId, Long currentUserId) {
        Task task = findTaskWithProjectTeamForUpdate(taskId);

        //permission check
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);

        TeamMember assignee = validateTeamMember(task.getProject().getTeam().getId(), userId);
        task.setAssignee(assignee);
        task.getAssignees().clear();
        task.getAssignees().add(assignee);
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
        taskRepository.save(task);

        User actor = userRepository.findById(currentUserId).orElse(null);
        String actorName = actor != null ? actor.getUsername() : "Unknown";
        taskActivityService.logActivity(task.getId(), TaskActivityType.ASSIGNEE_CHANGED,
                actorName, actorName + " assigned task to " + assignee.getUser().getUsername());

        if (!userId.equals(currentUserId)) {
            String message = "You were assigned to task: " + task.getTitle();
            String link = "/taskcard?taskId=" + task.getId();
            notificationService.createNotification(assignee.getUser(), message, link);
        }
    }

    // Dedicated PATCH endpoint logic for managing multiple assignees seamlessly.
    @Transactional
    public TaskResponseDTO updateAssignees(Long taskId, List<Long> userIds, Long currentUserId) {
        Task task = findTaskWithProjectTeamForUpdate(taskId);

        Long teamId = task.getProject().getTeam().getId();
        requireMinimumRole(teamId, currentUserId, TeamRole.MEMBER);

        // Step 1. Remember who was already assigned so we don't spam them with duplicate notifications.
        Set<Long> previousAssigneeUserIds = new LinkedHashSet<>();
        if (task.getAssignee() != null && task.getAssignee().getUser() != null) {
            previousAssigneeUserIds.add(task.getAssignee().getUser().getUserId());
        }

        // Step 2. Wipe the slate clean and rebuild the assignee list.
        task.getAssignees().stream()
                .map(TeamMember::getUser)
                .filter(Objects::nonNull)
                .map(User::getUserId)
                .filter(Objects::nonNull)
                .forEach(previousAssigneeUserIds::add);

        task.getAssignees().clear();
        List<Long> requestedAssigneeIds = userIds == null ? List.of() : userIds;
        for (Long uid : requestedAssigneeIds) {
            task.getAssignees().add(validateTeamMember(teamId, uid));
        }
        task.setAssignee(task.getAssignees().isEmpty() ? null : task.getAssignees().iterator().next());
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
        Task saved = taskRepository.save(task);

        User actor = userRepository.findById(currentUserId).orElse(null);
        String actorName = actor != null ? actor.getUsername() : "Unknown";
        taskActivityService.logActivity(saved.getId(), TaskActivityType.ASSIGNEE_CHANGED,
                actorName, actorName + " updated assignees");

        // Step 3. Determine the "Diff" (Who is new?)
        Set<Long> currentAssigneeUserIds = new LinkedHashSet<>();
        if (saved.getAssignee() != null && saved.getAssignee().getUser() != null) {
            currentAssigneeUserIds.add(saved.getAssignee().getUser().getUserId());
        }
        saved.getAssignees().stream()
            .map(TeamMember::getUser)
            .filter(Objects::nonNull)
            .map(User::getUserId)
            .filter(Objects::nonNull)
            .forEach(currentAssigneeUserIds::add);

        currentAssigneeUserIds.removeAll(previousAssigneeUserIds);
        currentAssigneeUserIds.remove(currentUserId);

        // Step 4. Send notifications only to the freshly added assignees.
        if (!currentAssigneeUserIds.isEmpty()) {
            String message = "You were assigned to task: " + saved.getTitle();
            String link = "/taskcard?taskId=" + saved.getId();
            userRepository.findAllById(currentAssigneeUserIds)
                .forEach(recipient -> notificationService.createNotification(recipient, message, link));
        }

        return getTaskByIdInternal(saved.getId());
    }

    // ── 13-16. DASHBOARD FEEDS & METRICS ────────────────────────────────────────

    @Transactional
    public void recordTaskAccess(Long taskId, Long currentUserId) {
        taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        taskAccessRepository.upsertTaskAccess(taskId, currentUserId);
    }

    //14. GET RECENT TASKS
    @Transactional(readOnly = true)
    public List<TaskResponseDTO> getRecentTasks(Long currentUserId, int limit) {
        Pageable pageable = PageRequest.of(0, limit);
        List<Long> taskIds = taskAccessRepository.findRecentTaskIdsByUser(currentUserId, pageable);
        return loadTaskDtosByIds(taskIds);
    }

    //15. GET ASSIGNED TASKS
    @Transactional(readOnly = true)
    public List<TaskResponseDTO> getAssignedTasks(Long currentUserId, int limit) {
        Pageable pageable = PageRequest.of(0, limit);
        List<Long> taskIds = taskRepository.findAssignedTaskIdsByUser(currentUserId, pageable);
        return loadTaskDtosByIds(taskIds);
    }

    //16. GET WORKED ON TASKS
    @Transactional(readOnly = true)
    public List<TaskResponseDTO> getWorkedOnTasks(Long currentUserId, int limit) {
        Pageable pageable = PageRequest.of(0, limit);
        List<Long> taskIds = taskRepository.findWorkedOnTaskIdsByUser(currentUserId, pageable);
        return loadTaskDtosByIds(taskIds);
    }

    //17. UPDATE PRIORITY
    @Transactional
    public TaskResponseDTO updatePriority(Long taskId, String priority, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);
        String oldPriority = task.getPriority() != null ? task.getPriority().name() : "NONE";
        task.setPriority(Priority.valueOf(priority));
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
        Task saved = taskRepository.save(task);
        User actor = userRepository.findById(currentUserId).orElse(null);
        String actorName = actor != null ? actor.getUsername() : "Unknown";

        if (!priority.equals(oldPriority)) {
            taskActivityService.logActivity(saved.getId(), TaskActivityType.PRIORITY_CHANGED,
                    actorName, "Priority changed from " + oldPriority + " to " + priority);
            String message = actorName + " changed task priority for \"" + saved.getTitle()
                    + "\" from " + oldPriority + " to " + priority;
            notifyTaskStakeholders(saved, currentUserId, message, "/taskcard?taskId=" + saved.getId());
        }
        return getTaskByIdInternal(saved.getId());
    }

    //17b. UPDATE STATUS (lightweight — used by kanban drag-and-drop)
    @Transactional
    public TaskResponseDTO updateStatus(Long taskId, String status, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);

        String oldStatus = task.getStatus();
        task.setStatus(status);

        // Set or clear completedAt when status transitions to/from DONE
        if ("DONE".equalsIgnoreCase(status) && !"DONE".equalsIgnoreCase(oldStatus)) {
            task.setCompletedAt(LocalDateTime.now());
        } else if (!"DONE".equalsIgnoreCase(status)) {
            task.setCompletedAt(null);
        }

        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
        Task saved = taskRepository.save(task);

        User actor = userRepository.findById(currentUserId).orElse(null);
        String actorName = actor != null ? actor.getUsername() : "Unknown";

        if (!status.equals(oldStatus)) {
            taskActivityService.logActivity(saved.getId(), TaskActivityType.STATUS_CHANGED,
                    actorName, "Status changed from " + oldStatus + " to " + status);
            String fromStatus = oldStatus != null ? oldStatus : "NONE";
            String message = actorName + " changed task status for \"" + saved.getTitle()
                    + "\" from " + fromStatus + " to " + status;
            notifyTaskStakeholders(saved, currentUserId, message, "/taskcard?taskId=" + saved.getId());
        }

        // BUG-006 Fix: check if all siblings are done when a subtask is updated
        checkAndAutoCompleteParent(saved, currentUserId);

        return getTaskByIdInternal(saved.getId());
    }

    @Transactional
    public void updateTaskColumn(Long taskId, Long columnId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        KanbanColumn column = kanbanColumnRepository.findById(columnId)
                .orElseThrow(() -> new ResourceNotFoundException("Kanban column not found"));
        task.setKanbanColumn(column);
        task.setStatus(column.getStatus());
        taskRepository.save(task);
    }

    /**
     * If the just-updated task is a subtask, checks whether all siblings are DONE.
     * If yes, auto-moves the parent to DONE and logs the activity.
     */
    private void checkAndAutoCompleteParent(Task updatedTask, Long actorUserId) {
        // Only act if this task is a subtask (has a parent)
        if (updatedTask.getParentTask() == null) return;

        Task parent = updatedTask.getParentTask();

        // Re-fetch subtasks fresh from DB to get current statuses
        List<Task> siblings = taskRepository.findSubtasksByParentId(parent.getId());

        // If any sibling is not DONE, stop; parent should not auto-complete
        boolean allDone = siblings.stream()
                .allMatch(s -> "DONE".equalsIgnoreCase(s.getStatus()));

        if (!allDone) return;

        // All subtasks are done; auto-complete parent if not already done
        if ("DONE".equalsIgnoreCase(parent.getStatus())) return;

        String oldParentStatus = parent.getStatus();
        parent.setStatus("DONE");
        parent.setCompletedAt(LocalDateTime.now());
        parent.setLastModifiedBy(updatedTask.getLastModifiedBy());
        taskRepository.save(parent);

        // Log the auto-completion activity
        taskActivityService.logActivity(
                parent.getId(),
                TaskActivityType.STATUS_CHANGED,
                "System",
                "Auto-completed: all subtasks are done (was: " + oldParentStatus + ")"
        );

        // Notify parent task stakeholders
        String actorName = updatedTask.getLastModifiedBy() != null
                ? updatedTask.getLastModifiedBy().getUsername()
                : "System";
        String message = "Task \"" + parent.getTitle()
                + "\" was auto-completed — all subtasks are now done.";
        notifyTaskStakeholders(parent, actorUserId, message,
                "/taskcard?taskId=" + parent.getId());
    }

    //18. UNASSIGN TASK
    @Transactional
    public void unassignTask(Long taskId, Long currentUserId) {
        Task task = findTaskWithProjectTeamForUpdate(taskId);
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);

        task.setAssignee(null);
        task.getAssignees().clear();
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
        taskRepository.save(task);

        User actor = userRepository.findById(currentUserId).orElse(null);
        String actorName = actor != null ? actor.getUsername() : "Unknown";
        taskActivityService.logActivity(task.getId(), TaskActivityType.ASSIGNEE_CHANGED,
                actorName, actorName + " unassigned the task");
    }

    @Transactional
    public void linkGithubIssue(Long taskId, Long githubIssueNumber, String githubRepoFullName, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);

        task.setGithubIssueNumber(githubIssueNumber);
        task.setGithubRepoFullName(githubRepoFullName);
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
        taskRepository.save(task);
    }

    //19. BULK UPDATE STATUS
    @Transactional
    public void bulkUpdateStatus(List<Long> taskIds, String status, Long currentUserId) {
        if (taskIds == null || taskIds.isEmpty()) return;

        List<Task> tasks = taskRepository.findByIdInWithDetails(taskIds);

        // OPTIMIZATION: We preload all memberships into a map ONCE.
        // If we queried the database for the user's role on every single iteration of the loop below,
        // a bulk update of 50 tasks would generate 50 redundant SQL queries.
        java.util.Map<Long, TeamMember> membershipByTeamId = preloadMembershipByTeamIds(tasks, currentUserId);

        List<Task> doneTransitioned = new java.util.ArrayList<>();
        User currentUser = userRepository.findById(currentUserId).orElseThrow();
        String actorName = currentUser.getUsername();

        for (Task task : tasks) {
            TeamMember member = membershipByTeamId.get(task.getProject().getTeam().getId());
            ensureMinimumRole(member, TeamRole.MEMBER);

            String oldTaskStatus = task.getStatus();
            task.setStatus(status);

            if ("DONE".equalsIgnoreCase(status) && !"DONE".equalsIgnoreCase(oldTaskStatus)) {
                task.setCompletedAt(LocalDateTime.now());
                doneTransitioned.add(task);
            } else if (!"DONE".equalsIgnoreCase(status)) {
                task.setCompletedAt(null);
            }
            task.setLastModifiedBy(currentUser);
        }
        taskRepository.saveAll(tasks);

        // Notify stakeholders of tasks that just moved to DONE
        if (!doneTransitioned.isEmpty()) {
            for (Task doneTask : doneTransitioned) {
                String message = actorName + " marked \"" + doneTask.getTitle() + "\" as Done";
                String link = "/taskcard?taskId=" + doneTask.getId();
                notifyTaskStakeholders(doneTask, currentUserId, message, link);
            }
        }
    }

    //20. BULK DELETE
    @Transactional
    public void bulkDelete(List<Long> taskIds, Long currentUserId) {
        if (taskIds == null || taskIds.isEmpty()) return;
        List<Task> tasks = taskRepository.findByIdInWithDetails(taskIds);
        java.util.Map<Long, TeamMember> membershipByTeamId = preloadMembershipByTeamIds(tasks, currentUserId);
        for (Task task : tasks) {
            TeamMember member = membershipByTeamId.get(task.getProject().getTeam().getId());
            ensureMinimumRole(member, null);
            if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.ADMIN) {
                throw new ForbiddenException("Access Denied: Only Project Owners or Admins can delete tasks.");
            }
        }
        taskRepository.deleteAll(tasks);
    }

    // ── INTERNAL HELPERS & RBAC ─────────────────────────────────────────────────

    private void notifyTaskStakeholders(Task task, Long actorUserId, String message, String link) {
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

        userRepository.findAllById(recipientIds)
                .forEach(user -> notificationService.createNotification(user, message, link));
    }

    //---HELPER-01--- : Require minimum role in team ---
    private TeamMember requireMinimumRole(Long teamId, Long userId, TeamRole minimumRole) {
        TeamMember member = teamMembershipLookupService.getTeamMember(teamId, userId);
        ensureMinimumRole(member, minimumRole);
        return member;
    }

    private void ensureMinimumRole(TeamMember member, TeamRole minimumRole) {
        if (member == null) {
            throw new ForbiddenException("User is not a member of this team");
        }
        // roleRank allows us to handle hierarchical permissions
        // (e.g., an ADMIN can do everything a MEMBER can do).
        if (minimumRole != null && roleRank(member.getRole()) < roleRank(minimumRole)) {
            throw new ForbiddenException("Insufficient permissions: requires " + minimumRole + " or higher");
        }
    }

    private int roleRank(TeamRole role) {
        return switch (role) {
            case OWNER  -> 4;
            case ADMIN  -> 3;
            case MEMBER -> 2;
            case VIEWER -> 1;
        };
    }

    //---HELPER-02--- : For Validate User is in Team---
    private TeamMember validateTeamMember(Long teamId, Long userId){
        TeamMember member = teamMembershipLookupService.getTeamMember(teamId, userId);
        if (member == null) {
            throw new ForbiddenException("Cannot assign task: user is not in the team");
        }
        return member;
    }

    private Task findTaskWithProjectTeam(Long taskId) {
        return taskRepository.findByIdWithProjectTeam(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
    }

    private Task findTaskWithProjectTeamForUpdate(Long taskId) {
        return taskRepository.findByIdWithProjectTeamForUpdate(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
    }

    // Extracts unique team IDs from a list of tasks and fetches membership data in one query.
    private java.util.Map<Long, TeamMember> preloadMembershipByTeamIds(List<Task> tasks, Long userId) {
        java.util.Set<Long> teamIds = tasks.stream()
                .map(Task::getProject)
                .filter(java.util.Objects::nonNull)
                .map(Project::getTeam)
                .filter(java.util.Objects::nonNull)
                .map(com.planora.backend.model.Team::getId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        if (teamIds.isEmpty()) {
            return java.util.Map.of();
        }
        return teamMembershipLookupService.getTeamMembersForTeams(teamIds, userId).stream()
                .filter(member -> member.getTeam() != null && member.getTeam().getId() != null)
                .collect(java.util.stream.Collectors.toMap(
                        member -> member.getTeam().getId(),
                        member -> member,
                        (left, right) -> left));
    }

    private Milestone resolveMilestoneForProject(Long projectId, Long milestoneId) {
        Milestone milestone = milestoneRepository.findById(milestoneId)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
        if (milestone.getProject() == null || !Objects.equals(milestone.getProject().getId(), projectId)) {
            throw new ForbiddenException("Milestone does not belong to this project");
        }
        return milestone;
    }

    // ── DATA TRANSFER OBJECT (DTO) MAPPING ──────────────────────────────────────

    private TaskResponseDTO mapToDTO(Task task) {
        return mapToDTO(task, null, null);
    }

    private TaskResponseDTO mapToDTO(Task task, java.util.Map<Long, List<DependencyDTO>> dependencyMap) {
        return mapToDTO(task, dependencyMap, null);
    }

    /**
     * Master mapper. The {@code githubSummary} parameter is optional (nullable):
     * when null all GitHub fields in the DTO are left null, preserving full
     * backward compatibility with every existing caller.
     */
    private TaskResponseDTO mapToDTO(Task task,
                                     java.util.Map<Long, List<DependencyDTO>> dependencyMap,
                                     TaskGithubSummaryDTO githubSummary) {
        TaskResponseDTO dto = new TaskResponseDTO();
        dto.setId(task.getId());
        dto.setProjectTaskNumber(task.getProjectTaskNumber());
        dto.setTitle(task.getTitle());
        dto.setDescription(task.getDescription());
        dto.setProjectId(task.getProject() != null ? task.getProject().getId() : null);
        dto.setProjectName(task.getProject() != null ? task.getProject().getName() : null);
        dto.setPriority(task.getPriority() != null ? task.getPriority().name(): null);
        dto.setStatus(task.getStatus());
        dto.setStoryPoint(task.getStoryPoint());
        dto.setDueDate(task.getDueDate());
        dto.setStartDate(task.getStartDate());
        dto.setCreatedAt(task.getCreatedAt());
        dto.setUpdatedAt(task.getUpdatedAt());
        dto.setCompletedAt(task.getCompletedAt());
        dto.setArchived(task.isArchived());
        dto.setArchivedAt(task.getArchivedAt());

        if(task.getSprint() != null){
            dto.setSprintId(task.getSprint().getId());
            dto.setSprintName(task.getSprint().getName());
        }

        if(task.getAssignee() != null && task.getAssignee().getUser() != null){
            dto.setAssigneeId(task.getAssignee().getId());
            dto.setAssigneeName(task.getAssignee().getUser().getUsername());
            dto.setAssigneePhotoUrl(userService.generatePresignedUrl(task.getAssignee().getUser().getProfilePicUrl()));
        }

        // Map multiple assignees (V4)
        if (task.getAssignees() != null) {
            dto.setAssignees(new ArrayList<>(task.getAssignees()).stream()
                .map(m -> {
                    if (m.getUser() == null) return null;
                    String fullName = m.getUser().getFullName();
                    String name = (fullName != null && !fullName.isBlank())
                            ? fullName
                            : m.getUser().getUsername();
                    return new TaskResponseDTO.AssigneeDTO(
                        m.getId(),
                        m.getUser().getUserId(),
                        name,
                        userService.generatePresignedUrl(m.getUser().getProfilePicUrl()));
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList()));
        }

        if(task.getReporter() != null && task.getReporter().getUser() != null){
            dto.setReporterId(task.getReporter().getUser().getUserId());
            dto.setReporterName(task.getReporter().getUser().getUsername());
        }

        if (task.getMilestone() != null) {
            dto.setMilestoneId(task.getMilestone().getId());
            dto.setMilestoneName(task.getMilestone().getName());
        }

        // Map subtasks
        if(task.getSubTasks() != null){
            dto.setSubtasks(new ArrayList<>(task.getSubTasks()).stream()
                .map(st -> new SubtaskDTO(
                    st.getId(),
                    st.getTitle(),
                    st.getStatus(),
                    st.getPriority() != null ? st.getPriority().name() : null,
                    st.getDueDate()))
                .collect(Collectors.toList()));
        }

        // Map labels
        if(task.getLabels() != null){
            dto.setLabels(new ArrayList<>(task.getLabels()).stream()
                .map(l -> new TaskResponseDTO.LabelDTO(l.getId(), l.getName(), l.getColor()))
                .collect(Collectors.toList()));
        }

        // Map dependencies
        if (dependencyMap != null) {
            dto.setDependencies(dependencyMap.getOrDefault(task.getId(), List.of()));
        } else {
            dto.setDependencies(buildDependencyMap(List.of(task.getId())).getOrDefault(task.getId(), List.of()));
        }

        // Map attachments
        if(task.getAttachments() != null){
            dto.setAttachments(new ArrayList<>(task.getAttachments()).stream()
                .map(a -> new TaskResponseDTO.AttachmentDTO(
                    a.getId(), a.getFileName(), a.getContentType(),
                    a.getFileSize(), a.getUploadedBy() != null ? a.getUploadedBy().getUsername() : "Unknown"))
                .collect(Collectors.toList()));
        }

        // Map recurrence fields (V7)
        dto.setRecurrenceRule(task.getRecurrenceRule());
        dto.setRecurrenceEnd(task.getRecurrenceEnd());
        dto.setNextOccurrence(task.getNextOccurrence());
        dto.setRecurrenceActive(task.isRecurrenceActive());
        dto.setCustomInterval(task.getCustomInterval());
        dto.setRecurrenceLimit(task.getRecurrenceLimit());
        dto.setRecurrenceCount(task.getRecurrenceCount());
        if (task.getRecurrenceParent() != null) {
            dto.setRecurrenceParentId(task.getRecurrenceParent().getId());
        }

        // Map GitHub integration fields (V8)
        // Issue linkage and branch are persisted on the task entity; the rest come from TaskGithubService.
        dto.setGithubIssueNumber(task.getGithubIssueNumber());
        dto.setGithubRepoFullName(task.getGithubRepoFullName());
        dto.setGithubBranch(task.getGithubBranch());
        if (githubSummary != null) {
            dto.setGithubPrCount(githubSummary.getPrCount());
            dto.setCiStatus(githubSummary.getCiStatus());

            if (githubSummary.getPullRequests() != null) {
                dto.setLinkedPrs(githubSummary.getPullRequests().stream()
                        .map(pr -> new TaskResponseDTO.LinkedPrDTO(
                                pr.getPrNumber(), pr.getTitle(), pr.getState(),
                                pr.getHtmlUrl(), pr.getAuthor(), pr.getCreatedAt()))
                        .collect(Collectors.toList()));
            }

            if (githubSummary.getCommits() != null) {
                // CommitItem.sha is already the 7-char short SHA — trimmed by TaskGithubService.
                dto.setRecentCommits(githubSummary.getCommits().stream()
                        .map(c -> new TaskResponseDTO.RecentCommitDTO(
                                c.getSha(), c.getMessage(), c.getAuthor(),
                                c.getCommittedAt(), c.getHtmlUrl()))
                        .collect(Collectors.toList()));
            }
        }

        return dto;
    }

    // Groups task dependencies tightly to avoid firing separate SQL queries.
    private java.util.Map<Long, List<DependencyDTO>> buildDependencyMap(List<Long> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return java.util.Map.of();
        }
        java.util.Map<Long, List<DependencyDTO>> map = new java.util.HashMap<>();
        List<Object[]> rows = taskRepository.findDependencyRowsByTaskIds(taskIds);
        if (rows != null) {
            for (Object[] row : rows) {
                Long blockedTaskId = (Long) row[0];
                Long blockerTaskId = (Long) row[1];
                String blockerTitle = (String) row[2];
                String blockerStatus = (String) row[3];
                if (blockedTaskId == null || blockerTaskId == null) {
                    continue;
                }
                map.computeIfAbsent(blockedTaskId, ignored -> new ArrayList<>())
                        .add(new DependencyDTO(blockerTaskId, blockerTitle, "BLOCKED_BY", blockerStatus));
            }
        }

        List<Object[]> depRows = taskRepository.findDependentRowsByTaskIds(taskIds);
        if (depRows != null) {
            for (Object[] row : depRows) {
                Long blockerTaskId = (Long) row[0];
                Long blockedTaskId = (Long) row[1];
                String blockedTitle = (String) row[2];
                String blockedStatus = (String) row[3];
                if (blockerTaskId == null || blockedTaskId == null) {
                    continue;
                }
                map.computeIfAbsent(blockerTaskId, ignored -> new ArrayList<>())
                        .add(new DependencyDTO(blockedTaskId, blockedTitle, "BLOCKS", blockedStatus));
            }
        }
        return map;
    }

    // Part of the Two-Phase fetch optimization strategy.
    private List<TaskResponseDTO> loadTaskDtosByIds(List<Long> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return List.of();
        }

        List<Task> scalarTasks = taskRepository.findByIdInWithScalars(taskIds);
        if (scalarTasks.isEmpty()) {
            return List.of();
        }
        List<Task> enrichedTasks = taskRepository.findByIdInWithCollections(taskIds);
        java.util.Map<Long, Task> scalarById = scalarTasks.stream()
                .collect(Collectors.toMap(Task::getId, t -> t, (t1, t2) -> t1));
        java.util.Map<Long, Task> enrichedById = enrichedTasks.stream()
                .collect(Collectors.toMap(Task::getId, t -> t, (t1, t2) -> t1));
        java.util.Map<Long, List<DependencyDTO>> dependencyMap = buildDependencyMap(taskIds);

        return taskIds.stream()
                .distinct()
                .map(id -> {
                    Task scalar = scalarById.get(id);
                    if (scalar == null) {
                        return null;
                    }
                    Task enriched = enrichedById.get(id);
                    if (enriched == null) {
                        return mapToDTO(scalar, dependencyMap);
                    }

                    // Reassemble the object graph carefully to leverage hibernate caching.
                    enriched.setProject(scalar.getProject());
                    enriched.setSprint(scalar.getSprint());
                    enriched.setAssignee(scalar.getAssignee());
                    enriched.setReporter(scalar.getReporter());
                    enriched.setMilestone(scalar.getMilestone());
                    return mapToDTO(enriched, dependencyMap);
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    /**
     * Atomically moves a Kanban task to a new status column and rewrites
     * {@code backlogPosition} for every task in the destination column.
     * Used by the drag-and-drop Kanban board so that a single HTTP call
     * commits both the status change and the new display order.
     *
     * @param projectId       project that owns the task (used for locking + auth)
     * @param taskId          ID of the task being moved
     * @param newStatus       target column status (e.g. IN_PROGRESS, DONE)
     * @param orderedTaskIds  ordered IDs of the entire destination column after the drag
     * @param currentUserId   the authenticated user performing the operation
     * @return the updated TaskResponseDTO for the moved task
     */
    @Transactional
    public TaskResponseDTO moveKanbanTask(Long projectId, Long taskId, String newStatus,
                                          List<Long> orderedTaskIds, Long currentUserId) {
        // 1. Lock the project row to prevent concurrent order corruption.
        Project project = projectRepository.findByIdWithLock(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        // 2. Authorisation — must be at least MEMBER.
        requireMinimumRole(project.getTeam().getId(), currentUserId, TeamRole.MEMBER);

        // 3. Load the task and verify it belongs to the requested project.
        Task task = findTaskWithProjectTeam(taskId);
        if (!Objects.equals(task.getProject().getId(), projectId)) {
            throw new ForbiddenException("Task does not belong to project " + projectId);
        }

        // 4. Update status (reuse updateStatus logic inline to avoid double-save).
        String oldStatus = task.getStatus();
        task.setStatus(newStatus);
        if ("DONE".equalsIgnoreCase(newStatus) && !"DONE".equalsIgnoreCase(oldStatus)) {
            task.setCompletedAt(LocalDateTime.now());
        } else if (!"DONE".equalsIgnoreCase(newStatus)) {
            task.setCompletedAt(null);
        }

        User actor = userRepository.findById(currentUserId).orElseThrow();
        task.setLastModifiedBy(actor);
        taskRepository.save(task);

        // Log the status change activity when the status actually changed.
        if (!newStatus.equals(oldStatus)) {
            taskActivityService.logActivity(task.getId(), TaskActivityType.STATUS_CHANGED,
                    actor.getUsername(), "Status changed from " + oldStatus + " to " + newStatus);
            String fromStatus = oldStatus != null ? oldStatus : "NONE";
            String message = actor.getUsername() + " moved \"" + task.getTitle()
                    + "\" from " + fromStatus + " to " + newStatus;
            notifyTaskStakeholders(task, currentUserId, message, "/taskcard?taskId=" + task.getId());
        }

        // 5. Rewrite backlogPosition for all tasks in the destination column order.
        if (orderedTaskIds != null && !orderedTaskIds.isEmpty()) {
            List<Task> columnTasks = taskRepository.findByIdInWithScalars(orderedTaskIds).stream()
                    .filter(t -> t.getProject() != null && Objects.equals(t.getProject().getId(), projectId))
                    .toList();
            java.util.Map<Long, Task> taskById = columnTasks.stream()
                    .collect(Collectors.toMap(Task::getId, t -> t, (t1, t2) -> t1));

            for (int index = 0; index < orderedTaskIds.size(); index++) {
                Long tid = orderedTaskIds.get(index);
                Task t = taskById.get(tid);
                if (t == null) continue;
                t.setBacklogPosition(index);
                t.setLastModifiedBy(actor);
            }
            taskRepository.saveAll(columnTasks);
        }

        // 6. Return the enriched DTO for the moved task.
        return getTaskByIdInternal(taskId);
    }

    // Handles the complex math of rearranging rows when a user drags and drops a task in the UI.
    @Transactional
    public void reorderTasks(Long projectId, Long sprintId, List<Long> orderedTaskIds, Long currentUserId) {
        Project project = projectRepository.findByIdWithLock(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        requireMinimumRole(project.getTeam().getId(), currentUserId, TeamRole.MEMBER);
        if (orderedTaskIds == null || orderedTaskIds.isEmpty()) {
            return;
        }
        List<Task> tasks = taskRepository.findByIdInWithScalars(orderedTaskIds).stream()
                .filter(task -> task.getProject() != null && Objects.equals(task.getProject().getId(), projectId))
                .toList();
        Sprint targetSprint = sprintId == null
                ? null
                : sprintRepository.findById(sprintId)
                .orElseThrow(() -> new ResourceNotFoundException("Sprint not found"));
        if (targetSprint != null && !Objects.equals(targetSprint.getProId(), projectId)) {
            throw new ForbiddenException("Sprint does not belong to project");
        }
        User actor = userRepository.findById(currentUserId).orElseThrow();
        java.util.Map<Long, Task> taskById = tasks.stream()
                .collect(Collectors.toMap(Task::getId, task -> task, (t1, t2) -> t1));

        // Iterate through the newly provided list and rewrite the position index integers
        for (int index = 0; index < orderedTaskIds.size(); index++) {
            Long taskId = orderedTaskIds.get(index);
            Task task = taskById.get(taskId);
            if (task == null) {
                continue;
            }
            if (sprintId == null) {
                task.setSprint(null);
                task.setBacklogPosition(index);
                task.setSprintPosition(null);
            } else {
                task.setSprint(targetSprint);
                task.setBacklogPosition(null);
                task.setSprintPosition(index);
            }
            task.setLastModifiedBy(actor);
        }
        taskRepository.saveAll(tasks);
    }

    // Computes the next occurrence date after today based on recurrence rule.
    private LocalDate computeNextOccurrence(LocalDate base, String rule, Integer customInterval) {
        LocalDate from = (base != null && base.isAfter(LocalDate.now())) ? base : LocalDate.now();
        if (rule == null) return null;
        int delta = (customInterval != null && customInterval > 0) ? customInterval : 1;
        return switch (rule.toUpperCase()) {
            case "DAILY", "CUSTOM_DAYS"     -> from.plusDays(delta);
            case "WEEKLY", "CUSTOM_WEEKS"   -> from.plusWeeks(delta);
            case "MONTHLY", "CUSTOM_MONTHS" -> from.plusMonths(delta);
            case "YEARLY", "CUSTOM_YEARS"   -> from.plusYears(delta);
            default                         -> null;
        };
    }
}
