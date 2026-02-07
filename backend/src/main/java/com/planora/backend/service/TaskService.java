package com.planora.backend.service;

import com.planora.backend.dto.CommentRequestDTO;
import com.planora.backend.dto.TaskRequestDTO;
import com.planora.backend.dto.TaskResponseDTO;
import com.planora.backend.model.*;
import com.planora.backend.repository.*;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

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


    // CREATE TASK
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
        task.setStoryPoint(request.getStoryPoint());
        task.setDueDate(request.getDueDate());
        task.setStartDate(request.getStartDate());

        //enum assign
        if(request.getPriority() != null) task.setPriority(Priority.valueOf(request.getPriority()));
        if(request.getStatus() != null) task.setStatus(Status.valueOf(request.getStatus()));

        //validate and assign users
        Long teamId = project.getTeam().getId();
        if(request.getAssigneeId() != null){
            task.setAssignee(validateTeamMember(teamId, request.getAssigneeId()));
        }

        //deafult reporter is the creator
        task.setReporter(validateTeamMember(teamId, currentUserId));

        return mapToDTO(taskRepository.save(task))

    }

    //Get Task By ID
    public TaskResponseDTO getTaskById(Long taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(()-> new EntityNotFoundException("Task not found"));
        return mapToDTO(task);
    }

    //Update Task
    @Transactional
    public TaskResponseDTO updateTask(Long taskId, TaskRequestDTO request, Long currentUserId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(()-> new EntityNotFoundException("Task not found"));

        //validate permission
        validatePermission(task.getProject().getTeam().getId(), currentUserId, TeamRole.VIEWER);

        //update fields

        if(request.getTitle() != null) task.setTitle(request.getTitle());
        if(request.getDescription() != null) task.setDescription(request.getDescription());
        if(request.getStoryPoint() != 0) task.setStoryPoint(request.getStoryPoint());
        if(request.getPriority() != null) task.setPriority(Priority.valueOf(request.getPriority()));
        if(request.getStatus() != null) task.setStatus(Status.valueOf(request.getStatus()));

        return mapToDTO(taskRepository.save(task));
    }

    //Delete Task
    public void deleteTask(Long taskId, Long currentUserId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(()-> new EntityNotFoundException("Task not found"));

        //validate user- OWNER
        Long teamId = task.getProject().getId();

        //fetch user role
        TeamMember member = teamMemberRepository.findByTeamIdAndUserId(teamId,currentUserId)
                .orElseThrow(()-> new RuntimeException("User is not a member"));

        if(member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.ADMIN){
            throw new RuntimeException("Access Denied: Only Project Owners /Admins can delete tasks.");
        }

        taskRepository.delete(task);
    }

    //Get Project Using ID
    public List<TaskResponseDTO> getTasksByProject(Long projectId) {
        return taskRepository.findByProjectId(projectId).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    //SubTask

    @Transactional
    public TaskResponseDTO createSubTask(Long parentId, TaskRequestDTO subTaskRequest, Long currentUserId) {
        Task parent = taskRepository.findById(parentId)
                .orElseThrow(()-> new EntityNotFoundException("Parent task is not found"));

        //permission check
        validatePermission(parent.getProject().getId(), currentUserId, TeamRole.VIEWER);

        //reuse create logic but set parent
        TaskResponseDTO childDTO = createTask(subTaskRequest, currentUserId);

        //link parent-child manually
        Task child = taskRepository.findById(childDTO.getId()).orElseThrow();
        child.setParentTask(parent);

        return mapToDTO(taskRepository.save(child));
    }

    //Dependency

    //Add Dependency
    @Transactional
    public void addDependency(Long taskId, Long blockerId) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        Task blocker = taskRepository.findById(blockerId).orElseThrow();

        task.getDependencies().add(blocker);
        taskRepository.save(task);
    }

    //Remove Dependency
    @Transactional
    public void removeDependency(Long taskId, Long blockerId) {
        Task task = taskRepository.findById(taskId).orElseThrow();
        Task blocker = taskRepository.findById(blockerId).orElseThrow();

        task.getDependencies().remove(blocker);
        taskRepository.save(task);
    }

    // Label

    public void addLabel(Long taskId, Long labelId) {
    }

    public void removeLabel(Long taskId, Long labelId) {
    }

    public void addComment(Long taskId, CommentRequestDTO request) {
    }

    public void assignUser(Long taskID, Long userId) {
    }

    private void validatePermission(Long teamId, Long userId, TeamRole forbiddenRole){
        TeamMember member = teamMemberRepository.findByTeamIdAndUserId(teamId,userId)
                .orElseThrow(()-> new RuntimeException("User is not a member of this Team"));

        //forbidden == viewer, owner, admin, member are allowed
        if(member.getRole() == forbiddenRole){
            throw new RuntimeException("Insufficient Permissions: " + forbiddenRole + " cannot perform this action.");
        }
    }

    private TeamMember validateTeamMember(Long teamId, Long userId){
        TeamMember member = teamMemberRepository.findByTeamIdAndUserId(teamId, userId)
                .orElseThrow(()-> new RuntimeException("Cannot assign task: user is not in the team"));

        return member;
    }

    private TaskResponseDTO mapToDTO(Task task){
        TaskResponseDTO dto = new TaskResponseDTO();
        dto.setId(task.getId());
        dto.setTitle(task.getTitle());
        dto.setDescription(task.getDescription());
        dto.setProjectId(task.getProject().getId());
        dto.setPriority(task.getPriority() != null ? task.getPriority().name(): null);
        dto.setStatus(task.getStatus() !=null ? task.getStatus().name(): null);

        if(task.getAssignee() != null){
            dto.setAssigneeId(task.getAssignee().getId());
            dto.setAssigneeName(task.getAssignee().getUser().getUsername());
        }
        return dto;
    }
}
