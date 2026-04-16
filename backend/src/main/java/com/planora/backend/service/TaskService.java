package com.planora.backend.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.dto.CommentRequestDTO;
import com.planora.backend.dto.TaskRequestDTO;
import com.planora.backend.dto.TaskResponseDTO;
import com.planora.backend.dto.TaskResponseDTO.DependencyDTO;
import com.planora.backend.dto.TaskResponseDTO.SubtaskDTO;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.Comment;
import com.planora.backend.model.Label;
import com.planora.backend.model.Milestone;
import com.planora.backend.model.Priority;
import com.planora.backend.model.Project;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskAccess;
import com.planora.backend.model.TaskActivityType;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.CommentRepository;
import com.planora.backend.repository.LabelRepository;
import com.planora.backend.repository.MilestoneRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TaskAccessRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.UserRepository;

@Service
public class TaskService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LabelRepository labelRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private SprintRepository sprintRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private TaskAccessRepository taskAccessRepository;

    @Autowired
    private TaskActivityService taskActivityService;

    @Autowired
    private MilestoneRepository milestoneRepository;

    @Autowired
    private UserService userService;

    @Autowired
    private TeamMembershipLookupService teamMembershipLookupService;

    // 1. CREATE TASK
    @Transactional
    public TaskResponseDTO createTask(TaskRequestDTO request, Long currentUserId) {
        // Validate Project
        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(()-> new ResourceNotFoundException("Project not found"));

        //Permission Check
        requireMinimumRole(project.getTeam().getId(), currentUserId, TeamRole.MEMBER);

        //Create Task Entity
        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        task.setProject(project);
        task.setProjectTaskNumber(taskRepository.findMaxProjectTaskNumberByProjectId(project.getId()) + 1L);

        task.setStoryPoint(request.getStoryPoint() != null ? request.getStoryPoint() : 0);

        task.setStartDate(request.getStartDate());
        task.setDueDate(request.getDueDate());

        //enum assign
        if(request.getPriority() != null) task.setPriority(Priority.valueOf(request.getPriority()));
        if(request.getStatus() != null) task.setStatus(request.getStatus());

        //handle sprint-if provided
        if(request.getSprintId() != null){
            Sprint sprint = sprintRepository.findById(request.getSprintId())
                    .orElseThrow(()-> new ResourceNotFoundException("Sprint not found"));
            task.setSprint(sprint);
            task.setSprintPosition(taskRepository.findMaxSprintPositionBySprintId(sprint.getId()) + 1);
            task.setBacklogPosition(null);
        } else {
            task.setBacklogPosition(taskRepository.findMaxBacklogPositionByProjectId(project.getId()) + 1);
            task.setSprintPosition(null);
        }

        if (request.getMilestoneId() != null) {
            task.setMilestone(resolveMilestoneForProject(project.getId(), request.getMilestoneId()));
        }

        // handle labels
        if (request.getLabelIds() != null && !request.getLabelIds().isEmpty()) {
            for (Long labelId : request.getLabelIds()) {
                labelRepository.findById(labelId).ifPresent(label -> task.getLabels().add(label));
            }
        }

        //validate and assign users
        Long teamId = project.getTeam().getId();

        //handle assignee
        if(request.getAssigneeId() != null){
            task.setAssignee(validateTeamMember(teamId, request.getAssigneeId()));
        }

        // handle multiple assignees (V4)
        if (request.getAssigneeIds() != null && !request.getAssigneeIds().isEmpty()) {
            for (Long aid : request.getAssigneeIds()) {
                task.getAssignees().add(validateTeamMember(teamId, aid));
            }
            if (task.getAssignee() == null && !task.getAssignees().isEmpty()) {
                task.setAssignee(task.getAssignees().iterator().next());
            }
        }

        //default reporter is the creator
        task.setReporter(validateTeamMember(teamId, currentUserId));

        // Set last modified by
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());

        // Recurring task fields (V7)
        if (request.getRecurrenceRule() != null) {
            task.setRecurrenceRule(request.getRecurrenceRule());
            task.setRecurrenceEnd(request.getRecurrenceEnd());
            task.setNextOccurrence(computeNextOccurrence(task.getDueDate(), request.getRecurrenceRule()));
        }

        Task savedTask = taskRepository.save(task);

        // Log activity using the reporter that was already resolved above
        String actorName = savedTask.getReporter() != null
                ? savedTask.getReporter().getUser().getUsername()
                : "System";
        taskActivityService.logActivity(savedTask.getId(), TaskActivityType.TASK_CREATED,
                actorName, "Task created: " + savedTask.getTitle());

        // Notify assignee if set and is not the creator
        if (task.getAssignee() != null && !task.getAssignee().getUser().getUserId().equals(currentUserId)) {
            String message = "You were assigned to a new task: " + task.getTitle();
            String link = "/taskcard?taskId=" + savedTask.getId();
            notificationService.createNotification(task.getAssignee().getUser(), message, link);
        }

        return getTaskById(savedTask.getId());

    }

    //2. GET TASK BY ID
    @Transactional(readOnly = true)
    public TaskResponseDTO getTaskById(Long taskId) {
        Task task = taskRepository.findByIdWithDetails(taskId)
                .orElseThrow(()-> new ResourceNotFoundException("Task not found"));
        return mapToDTO(task);
    }

    //3. UPDATE TASK
    @Transactional
    public TaskResponseDTO updateTask(Long taskId, TaskRequestDTO request, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);

        Long teamId = task.getProject().getTeam().getId();

        //validate permission
        requireMinimumRole(teamId, currentUserId, TeamRole.MEMBER);

        // Track old values for activity logging
        String oldStatus = task.getStatus();
        Priority oldPriority = task.getPriority();

        //update fields-basic
        if(request.getTitle() != null) task.setTitle(request.getTitle());
        if(request.getDescription() != null) task.setDescription(request.getDescription());
        if(request.getPriority() != null) task.setPriority(Priority.valueOf(request.getPriority()));
        if(request.getStatus() != null) task.setStatus(request.getStatus());

        // Set or clear completedAt when status transitions to/from DONE
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


        //update sprint(moving to different sprints)
        if(request.isSprintIdProvided()){
            if (request.getSprintId() == null) {
                task.setSprint(null);
                task.setSprintPosition(null);
                task.setBacklogPosition(taskRepository.findMaxBacklogPositionByProjectId(task.getProject().getId()) + 1);
            } else {
                Sprint sprint = sprintRepository.findById(request.getSprintId())
                        .orElseThrow(()->new ResourceNotFoundException("Sprint not found"));
                task.setSprint(sprint);
                task.setBacklogPosition(null);
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

        //update reporter
        if(request.getReporterId() != null){
            TeamMember newReporter= validateTeamMember(teamId, request.getReporterId());
            task.setReporter(newReporter);
        }

        // update multiple assignees (V4)
        if (request.getAssigneeIds() != null) {
            task.getAssignees().clear();
            for (Long aid : request.getAssigneeIds()) {
                task.getAssignees().add(validateTeamMember(teamId, aid));
            }
            task.setAssignee(task.getAssignees().isEmpty() ? null : task.getAssignees().iterator().next());
        }

        // update recurrence (V7)
        if (request.getRecurrenceRule() != null) {
            task.setRecurrenceRule(request.getRecurrenceRule());
            task.setRecurrenceEnd(request.getRecurrenceEnd());
            task.setNextOccurrence(computeNextOccurrence(task.getDueDate(), request.getRecurrenceRule()));
        }

        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
    Task saved = taskRepository.save(task);
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
        return getTaskById(saved.getId());
    }

    /** Lightweight date-only update used by calendar drag-and-drop. */
    @Transactional
    public void patchTaskDates(
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
        taskRepository.save(task);
    }

    //4. DELETE TASK
    @Transactional
    public Long deleteTask(Long taskId, Long currentUserId) {
        Task task = taskRepository.findByIdWithDetails(taskId)
                .orElseThrow(()-> new ResourceNotFoundException("Task not found"));

        //validate user - OWNER or ADMIN only
        Long teamId = task.getProject().getTeam().getId();
        Long projectId = task.getProject().getId();

        TeamMember member = requireMinimumRole(teamId, currentUserId, null);

        if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.ADMIN) {
            throw new ForbiddenException("Access Denied: Only Project Owners or Admins can delete tasks.");
        }

        // Collect notification data BEFORE delete so lazy-loaded associations are accessible
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

        // Delete the task first so delete never silently fails after notifications go out
        taskRepository.delete(task);

        // Send notifications after successful delete
        for (User recipient : recipients) {
            notificationService.createNotification(recipient, message, taskLink);
        }

        return projectId;
    }

    //5. GET PROJECT BY ID
    @Transactional(readOnly = true)
    public List<TaskResponseDTO> getTasksByProject(Long projectId, Long currentUserId,
                                                   String status, Long assigneeId,
                                                   String priority, Long sprintId, Long milestoneId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        requireMinimumRole(project.getTeam().getId(), currentUserId, null);

        boolean hasFilters = status != null || assigneeId != null || priority != null || sprintId != null || milestoneId != null;
        if (hasFilters) {
            List<Task> filteredTasks = taskRepository.findByProjectIdFiltered(projectId, status, assigneeId, priority, sprintId, milestoneId)
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
                    .collect(java.util.stream.Collectors.toMap(Task::getId, t -> t));
            return filteredTasks.stream()
                    .map(t -> mapToDTO(enrichedMap.getOrDefault(t.getId(), t), dependencyMap))
                    .collect(Collectors.toList());
        }

        // Two-phase fetch to avoid cartesian product with multiple bags
        List<Task> tasks = taskRepository.findByProjectIdWithScalars(projectId);
        if (tasks.isEmpty()) return List.of();
        List<Long> ids = tasks.stream().map(Task::getId).collect(Collectors.toList());
        List<Task> enriched = taskRepository.findByIdInWithCollections(ids);
        java.util.Map<Long, List<DependencyDTO>> dependencyMap = buildDependencyMap(ids);
        java.util.Map<Long, Task> enrichedMap = enriched.stream()
                .collect(java.util.stream.Collectors.toMap(Task::getId, t -> t));
        return tasks.stream()
                .map(t -> mapToDTO(enrichedMap.getOrDefault(t.getId(), t), dependencyMap))
                .collect(Collectors.toList());
    }

    //----SUB TASKS--

    //6. CREATE SUB TASK
    @Transactional
    public TaskResponseDTO createSubTask(Long parentId, TaskRequestDTO subTaskRequest, Long currentUserId) {
        Task parent = findTaskWithProjectTeam(parentId);

        //permission check
        requireMinimumRole(parent.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);

        //reuse create logic but set parent
        subTaskRequest.setProjectId(parent.getProject().getId());
        TaskResponseDTO childDTO = createTask(subTaskRequest, currentUserId);

        //link parent-child manually
        Task child = taskRepository.findById(childDTO.getId()).orElseThrow();
        child.setParentTask(parent);
        Task savedChild = taskRepository.save(child);

        User actor = userRepository.findById(currentUserId).orElse(null);
        String actorName = actor != null ? actor.getUsername() : "Unknown";
        taskActivityService.logActivity(parentId, TaskActivityType.SUBTASK_ADDED,
                actorName, actorName + " added subtask: " + savedChild.getTitle());

        return getTaskById(savedChild.getId());
    }

    //DEPENDENCY

    //7. ADD DEPENDENCY
    @Transactional
    public void addDependency(Long taskId, Long blockerId, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, TeamRole.MEMBER);

        if (taskId.equals(blockerId)) {
            throw new IllegalArgumentException("A task cannot depend on itself");
        }

        Task blocker = findTaskWithProjectTeam(blockerId);
        task.getDependencies().add(blocker);
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
        taskRepository.save(task);
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

    // LABEL

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

    //COMMENTS

    //11. ADD COMMENT
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

        // Log activity
        String preview = request.getContent().length() > 60
                ? request.getContent().substring(0, 60) + "…"
                : request.getContent();
        taskActivityService.logActivity(taskId, TaskActivityType.COMMENT_ADDED,
                author.getUsername(), author.getUsername() + " commented: " + preview);

        // Notify task stakeholders (assignee + reporter), excluding the comment author
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
        requireMinimumRole(task.getProject().getTeam().getId(), currentUserId, null);
        
        return commentRepository.findByTaskOrderByCreatedAtAsc(task).stream()
                .map(c -> com.planora.backend.dto.CommentResponseDTO.builder()
                        .id(c.getId())
                        .text(c.getContent())
                        .authorName(c.getAuthor().getUsername())
                        .createdAt(c.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    //12. ASSIGN MEMBER
    @Transactional
    public void assignUser(Long taskID, Long userId, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskID);

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

    //12b. UPDATE MULTI-ASSIGNEES (dedicated PATCH endpoint)
    @Transactional
    public TaskResponseDTO updateAssignees(Long taskId, List<Long> userIds, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);

        Long teamId = task.getProject().getTeam().getId();
        requireMinimumRole(teamId, currentUserId, TeamRole.MEMBER);

        task.getAssignees().clear();
        for (Long uid : userIds) {
            task.getAssignees().add(validateTeamMember(teamId, uid));
        }
        task.setAssignee(task.getAssignees().isEmpty() ? null : task.getAssignees().iterator().next());
        task.setLastModifiedBy(userRepository.findById(currentUserId).orElseThrow());
        Task saved = taskRepository.save(task);

        User actor = userRepository.findById(currentUserId).orElse(null);
        String actorName = actor != null ? actor.getUsername() : "Unknown";
        taskActivityService.logActivity(saved.getId(), TaskActivityType.ASSIGNEE_CHANGED,
                actorName, actorName + " updated assignees");

        return getTaskById(saved.getId());
    }

    //13. RECORD TASK ACCESS
    @Transactional
    public void recordTaskAccess(Long taskId, Long currentUserId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        TaskAccess access = taskAccessRepository.findByTaskAndUser(task, user)
                .orElse(new TaskAccess(null, task, user, null));
        
        taskAccessRepository.save(access);
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
        return getTaskById(saved.getId());
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

        return getTaskById(saved.getId());
    }

    //18. UNASSIGN TASK
    @Transactional
    public void unassignTask(Long taskId, Long currentUserId) {
        Task task = findTaskWithProjectTeam(taskId);
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

    //19. BULK UPDATE STATUS
    @Transactional
    public void bulkUpdateStatus(List<Long> taskIds, String status, Long currentUserId) {
        if (taskIds == null || taskIds.isEmpty()) return;
        List<Task> tasks = taskRepository.findByIdInWithDetails(taskIds);
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

        // NTH-2: notify stakeholders of tasks that just moved to DONE
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

    //MAPPING DTO
    private TaskResponseDTO mapToDTO(Task task){
        return mapToDTO(task, null);
    }

    private TaskResponseDTO mapToDTO(Task task, java.util.Map<Long, List<DependencyDTO>> dependencyMap){
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
                    return new TaskResponseDTO.AssigneeDTO(
                    m.getId(),
                    m.getUser().getUserId(),
                    m.getUser().getUsername(),
                    userService.generatePresignedUrl(m.getUser().getProfilePicUrl()));
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList()));
        }

        if(task.getReporter() != null && task.getReporter().getUser() != null){
            dto.setReporterId(task.getReporter().getId());
            dto.setReporterName(task.getReporter().getUser().getUsername());
        }

        if (task.getMilestone() != null) {
            dto.setMilestoneId(task.getMilestone().getId());
            dto.setMilestoneName(task.getMilestone().getName());
        }

        // Map subtasks
        if(task.getSubTasks() != null){
            dto.setSubtasks(new ArrayList<>(task.getSubTasks()).stream()
                .map(st -> new SubtaskDTO(st.getId(), st.getTitle(), st.getStatus()))
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
        } else if(task.getDependencies() != null){
            dto.setDependencies(new ArrayList<>(task.getDependencies()).stream()
                .map(d -> new DependencyDTO(d.getId(), d.getTitle(), "BLOCKED_BY"))
                .collect(Collectors.toList()));
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
        if (task.getRecurrenceParent() != null) {
            dto.setRecurrenceParentId(task.getRecurrenceParent().getId());
        }

        return dto;
    }

    private java.util.Map<Long, List<DependencyDTO>> buildDependencyMap(List<Long> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return java.util.Map.of();
        }
        java.util.Map<Long, List<DependencyDTO>> map = new java.util.HashMap<>();
        for (Object[] row : taskRepository.findDependencyRowsByTaskIds(taskIds)) {
            Long blockedTaskId = (Long) row[0];
            Long blockerTaskId = (Long) row[1];
            String blockerTitle = (String) row[2];
            if (blockedTaskId == null || blockerTaskId == null) {
                continue;
            }
            map.computeIfAbsent(blockedTaskId, ignored -> new ArrayList<>())
                    .add(new DependencyDTO(blockerTaskId, blockerTitle, "BLOCKED_BY"));
        }
        return map;
    }

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
                .collect(Collectors.toMap(Task::getId, t -> t));
        java.util.Map<Long, Task> enrichedById = enrichedTasks.stream()
                .collect(Collectors.toMap(Task::getId, t -> t));
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

    @Transactional
    public void reorderTasks(Long projectId, Long sprintId, List<Long> orderedTaskIds, Long currentUserId) {
        Project project = projectRepository.findById(projectId)
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
                .collect(Collectors.toMap(Task::getId, task -> task));
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

    /** Compute the next occurrence date after today based on recurrence rule. */
    private LocalDate computeNextOccurrence(LocalDate base, String rule) {
        LocalDate from = (base != null && base.isAfter(LocalDate.now())) ? base : LocalDate.now();
        if (rule == null) return null;
        return switch (rule.toUpperCase()) {
            case "DAILY"   -> from.plusDays(1);
            case "WEEKLY"  -> from.plusWeeks(1);
            case "MONTHLY" -> from.plusMonths(1);
            case "YEARLY"  -> from.plusYears(1);
            default        -> null;
        };
    }
}
