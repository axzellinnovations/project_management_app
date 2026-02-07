package com.planora.backend.service;

import com.planora.backend.dto.CommentRequestDTO;
import com.planora.backend.dto.TaskRequestDTO;
import com.planora.backend.dto.TaskResponseDTO;
import com.planora.backend.model.Project;
import com.planora.backend.repository.*;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

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

    @Transactional
    public TaskResponseDTO createTask(TaskRequestDTO request, Long currentUserId) {

    }

    public TaskResponseDTO getTaskById(Long taskId) {
    }

    public List<TaskResponseDTO> updateTask(Long taskId, TaskRequestDTO request) {
    }

    public void deleteTask(Long taskId) {
    }

    public List<TaskResponseDTO> getTasksByProject(Long projectId) {
    }

    public TaskResponseDTO createSubTask(Long parentId, TaskRequestDTO subTaskRequest) {
    }

    public void addDependency(Long taskId, Long blockerId) {
    }

    public void removeDependency(Long taskId, Long blockerId) {
    }

    public void addLabel(Long taskId, Long labelId) {
    }

    public void removeLabel(Long taskId, Long labelId) {
    }

    public void addComment(Long taskId, CommentRequestDTO request) {
    }

    public void assignUser(Long taskID, Long userId) {
    }
}
