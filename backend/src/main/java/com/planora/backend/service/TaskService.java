package com.planora.backend.service;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.planora.backend.dto.CommentRequestDTO;
import com.planora.backend.dto.TaskRequestDTO;
import com.planora.backend.dto.TaskResponseDTO;
import com.planora.backend.dto.TaskResponseDTO.DependencyDTO;
import com.planora.backend.dto.TaskResponseDTO.LabelDTO;
import com.planora.backend.dto.TaskResponseDTO.SubtaskDTO;
import com.planora.backend.model.Comment;
import com.planora.backend.model.Label;
import com.planora.backend.model.Priority;
import com.planora.backend.model.Project;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskActivityType;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.CommentRepository;
import com.planora.backend.repository.LabelRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;

import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;

@Service
public class TaskService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TeamMemberRepository teamMemberRepository;

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
    private TaskActivityService taskActivityService;


    // 1. CREATE TASK
    @Transactional
    public TaskResponseDTO createTask(TaskRequestDTO request, Long currentUserId) {
        // Validate Project
        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(()-> new EntityNotFoundException("Project not found"));

        //Permission Check
        validatePermission(project.getTeam().getId(), currentUserId, TeamRole.VIEWER);

        //Create Task Entity
        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        task.setProject(project);

        task.setStoryPoint(request.getStoryPoint() != null ? request.getStoryPoint() : 0);

        // Ensure every task has a start date (use creation date when not provided) and a due date.
        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : LocalDate.now();
        task.setStartDate(startDate);
        task.setDueDate(request.getDueDate() != null ? request.getDueDate() : startDate);

        //enum assign
        if(request.getPriority() != null) task.setPriority(Priority.valueOf(request.getPriority()));
        if(request.getStatus() != null) task.setStatus(request.getStatus());

        //handle sprint-if provided
        if(request.getSprintId() != null){
            Sprint sprint = sprintRepository.findById(request.getSprintId())
                    .orElseThrow(()-> new EntityNotFoundException("Entity not found"));
            task.setSprint(sprint);
        }
        //validate and assign users
        Long teamId = project.getTeam().getId();

        //handle assignee
        if(request.getAssigneeId() != null){
            task.setAssignee(validateTeamMember(teamId, request.getAssigneeId()));
        }

        //deafult reporter is the creator
        task.setReporter(validateTeamMember(teamId, currentUserId));

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

        return mapToDTO(savedTask);

    }

    //2. GET TASK BY ID
    @Transactional
    public TaskResponseDTO getTaskById(Long taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(()-> new EntityNotFoundException("Task not found"));
        return mapToDTO(task);
    }

    //3. UPDATE TASK
    @Transactional
    public TaskResponseDTO updateTask(Long taskId, TaskRequestDTO request, Long currentUserId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(()-> new EntityNotFoundException("Task not found"));

        Long teamId = task.getProject().getTeam().getId();

        //validate permission
        validatePermission(teamId, currentUserId, TeamRole.VIEWER);

        // Track old values for activity logging
        String oldStatus = task.getStatus();
        Priority oldPriority = task.getPriority();

        //update fields-basic
        if(request.getTitle() != null) task.setTitle(request.getTitle());
        if(request.getDescription() != null) task.setDescription(request.getDescription());
        if(request.getPriority() != null) task.setPriority(Priority.valueOf(request.getPriority()));
        if(request.getStatus() != null) task.setStatus(request.getStatus());

        //update fields-other attributes
        if(request.getStoryPoint() != null) task.setStoryPoint(request.getStoryPoint());
        if(request.getStartDate() != null) task.setStartDate(request.getStartDate());
        if(request.getDueDate() != null) task.setDueDate(request.getDueDate());


        //update sprint(moving to different sprints)
        if(request.getSprintId() != null){
            Sprint sprint = sprintRepository.findById(request.getSprintId())
                    .orElseThrow(()->new EntityNotFoundException("Sprint not found"));
            task.setSprint(sprint);
        }

        //update reporter
        if(request.getReporterId() != null){
            TeamMember newReporter= validateTeamMember(teamId, request.getReporterId());
            task.setReporter(newReporter);
        }

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
        return mapToDTO(saved);
    }

    //4. DELETE TASK
    public void deleteTask(Long taskId, Long currentUserId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(()-> new EntityNotFoundException("Task not found"));

        //validate user- OWNER
        Long teamId = task.getProject().getTeam().getId();

        //fetch user role
        TeamMember member = teamMemberRepository.findByTeamIdAndUserUserId(teamId,currentUserId)
                .orElseThrow(()-> new RuntimeException("User is not a member"));

        if(member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.ADMIN){
            throw new RuntimeException("Access Denied: Only Project Owners /Admins can delete tasks.");
        }

        String taskLink = "/taskcard?taskId=" + task.getId();
        String actorName = userRepository.findById(currentUserId)
                .map(User::getUsername)
                .orElse("Unknown");
        String message = actorName + " deleted task: " + task.getTitle();
        notifyTaskStakeholders(task, currentUserId, message, taskLink);

        taskRepository.delete(task);
    }

    //5. GET PROJECT BY ID
    @Transactional
    public List<TaskResponseDTO> getTasksByProject(Long projectId, Long currentUserId) {
        // Check if user has permission to view tasks in this project
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        validatePermission(project.getTeam().getId(), currentUserId, null); // Allow all team members to view

        return taskRepository.findByProjectId(projectId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    //----SUB TASKS--

    //6. CREATE SUB TASK
    @Transactional
    public TaskResponseDTO createSubTask(Long parentId, TaskRequestDTO subTaskRequest, Long currentUserId) {
        Task parent = taskRepository.findById(parentId)
                .orElseThrow(()-> new EntityNotFoundException("Parent task is not found"));

        //permission check
        validatePermission(parent.getProject().getTeam().getId(), currentUserId, TeamRole.VIEWER);

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

        return mapToDTO(savedChild);
    }

    //DEPENDENCY

    //7. ADD DEPENDENCY
    @Transactional
    public void addDependency(Long taskId, Long blockerId, Long currentUserId) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        validatePermission(task.getProject().getTeam().getId(),currentUserId, TeamRole.VIEWER);

        Task blocker = taskRepository.findById(blockerId).orElseThrow();
        task.getDependencies().add(blocker);
        taskRepository.save(task);
    }

    //8. REMOVE DEPENDENCY
    @Transactional
    public void removeDependency(Long taskId, Long blockerId, Long currentUserId) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        validatePermission(task.getProject().getTeam().getId(),currentUserId, TeamRole.VIEWER);

        Task blocker = taskRepository.findById(blockerId).orElseThrow();
        task.getDependencies().remove(blocker);
        taskRepository.save(task);
    }

    // LABEL

    //9. ADD LABEL
    @Transactional
    public void addLabel(Long taskId, Long labelId, Long currentUserId) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        validatePermission(task.getProject().getTeam().getId(),currentUserId, TeamRole.VIEWER);

        Label label = labelRepository.findById(labelId).orElseThrow();
        task.getLabels().add(label);
        taskRepository.save(task);
    }

    //10. REMOVE LABEL
    @Transactional
    public void removeLabel(Long taskId, Long labelId, Long currentUserId) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        validatePermission(task.getProject().getTeam().getId(),currentUserId, TeamRole.VIEWER);

        Label label = labelRepository.findById(labelId).orElseThrow();
        task.getLabels().remove(label);
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

        // Log activity
        String preview = request.getContent().length() > 60
                ? request.getContent().substring(0, 60) + "…"
                : request.getContent();
        taskActivityService.logActivity(taskId, TaskActivityType.COMMENT_ADDED,
                author.getUsername(), author.getUsername() + " commented: " + preview);

        // Notify assignee if the comment author is not the assignee
        if (task.getAssignee() != null && !task.getAssignee().getUser().getUserId().equals(currentUserId)) {
            String message = author.getUsername() + " commented on task: " + task.getTitle();
            String link = "/taskcard?taskId=" + task.getId();
            notificationService.createNotification(task.getAssignee().getUser(), message, link);
        }
    }

    public List<com.planora.backend.dto.CommentResponseDTO> getComments(Long taskId, Long currentUserId) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        validatePermission(task.getProject().getTeam().getId(), currentUserId, null);
        
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
        Task task = taskRepository.findById(taskID).orElseThrow();

        //permission check
        validatePermission(task.getProject().getTeam().getId(), currentUserId, TeamRole.VIEWER);

        TeamMember assignee = validateTeamMember(task.getProject().getTeam().getId(), userId);
        task.setAssignee(assignee);
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

    //13. UPDATE PRIORITY
    @Transactional
    public TaskResponseDTO updatePriority(Long taskId, String priority, Long currentUserId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found"));
        validatePermission(task.getProject().getTeam().getId(), currentUserId, TeamRole.VIEWER);
        String oldPriority = task.getPriority() != null ? task.getPriority().name() : "NONE";
        task.setPriority(Priority.valueOf(priority));
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
        return mapToDTO(saved);
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

    //---HELPER-01--- : For Permission Checking ---
    private void validatePermission(Long teamId, Long userId, TeamRole forbiddenRole){
        TeamMember member = teamMemberRepository.findByTeamIdAndUserUserId(teamId,userId)
                .orElseThrow(()-> new RuntimeException("User is not a member of this Team"));

        // If forbiddenRole is specified, check that user doesn't have that role
        if(forbiddenRole != null && member.getRole() == forbiddenRole){
            throw new RuntimeException("Insufficient Permissions: " + forbiddenRole + " cannot perform this action.");
        }
    }

    //---HELPER-02--- : For Validate User is in Team---
    private TeamMember validateTeamMember(Long teamId, Long userId){
        return teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(()-> new RuntimeException("Cannot assign task: user is not in the team"));
    }

    //MAPPING DTO
    private TaskResponseDTO mapToDTO(Task task){
        TaskResponseDTO dto = new TaskResponseDTO();
        dto.setId(task.getId());
        dto.setTitle(task.getTitle());
        dto.setDescription(task.getDescription());
        dto.setProjectId(task.getProject().getId());
        dto.setProjectName(task.getProject().getName());
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

        if(task.getAssignee() != null){
            dto.setAssigneeId(task.getAssignee().getId());
            dto.setAssigneeName(task.getAssignee().getUser().getUsername());
            dto.setAssigneePhotoUrl(task.getAssignee().getUser().getProfilePicUrl());
        }

        if(task.getReporter() != null){
            dto.setReporterId(task.getReporter().getId());
            dto.setReporterName(task.getReporter().getUser().getUsername());
        }

        // Map subtasks
        if(task.getSubTasks() != null){
            dto.setSubtasks(task.getSubTasks().stream()
                .map(st -> new SubtaskDTO(st.getId(), st.getTitle(), st.getStatus()))
                .collect(Collectors.toList()));
        }

        // Map labels
        if(task.getLabels() != null){
            dto.setLabels(task.getLabels().stream()
                .map(l -> new LabelDTO(l.getId(), l.getName()))
                .collect(Collectors.toList()));
        }

        // Map dependencies
        if(task.getDependencies() != null){
            dto.setDependencies(task.getDependencies().stream()
                .map(d -> new DependencyDTO(d.getId(), d.getTitle(), "BLOCKED_BY"))
                .collect(Collectors.toList()));
        }

        // Map attachments
        if(task.getAttachments() != null){
            dto.setAttachments(task.getAttachments().stream()
                .map(a -> new TaskResponseDTO.AttachmentDTO(
                    a.getId(), a.getFileName(), a.getContentType(),
                    a.getFileSize(), a.getUploadedBy().getUsername()))
                .collect(Collectors.toList()));
        }

        return dto;
    }
}