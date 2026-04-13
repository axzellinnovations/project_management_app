package com.planora.backend.service;

import com.planora.backend.dto.MilestoneRequestDTO;
import com.planora.backend.dto.MilestoneResponseDTO;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.Milestone;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.model.TeamRole;
import com.planora.backend.repository.MilestoneRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class MilestoneService {

    @Autowired
    private MilestoneRepository milestoneRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TeamMemberRepository teamMemberRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Transactional
    public MilestoneResponseDTO createMilestone(Long projectId, MilestoneRequestDTO dto, Long currentUserId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        requireAtLeastMember(project.getTeam().getId(), currentUserId);

        Milestone milestone = new Milestone();
        milestone.setProject(project);
        milestone.setName(dto.getName());
        milestone.setDescription(dto.getDescription());
        milestone.setDueDate(dto.getDueDate());
        milestone.setStatus(dto.getStatus() != null ? dto.getStatus() : "OPEN");

        return toDTO(milestoneRepository.save(milestone));
    }

    @Transactional(readOnly = true)
    public List<MilestoneResponseDTO> getMilestonesByProject(Long projectId, Long currentUserId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        requireAtLeastMember(project.getTeam().getId(), currentUserId);
        return milestoneRepository.findByProjectId(projectId)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public MilestoneResponseDTO getMilestoneById(Long milestoneId) {
        return toDTO(findOrThrow(milestoneId));
    }

    @Transactional
    public MilestoneResponseDTO updateMilestone(Long milestoneId, MilestoneRequestDTO dto, Long currentUserId) {
        Milestone milestone = findOrThrow(milestoneId);
        requireAtLeastMember(milestone.getProject().getTeam().getId(), currentUserId);

        if (dto.getName() != null) milestone.setName(dto.getName());
        if (dto.getDescription() != null) milestone.setDescription(dto.getDescription());
        if (dto.getDueDate() != null) milestone.setDueDate(dto.getDueDate());
        if (dto.getStatus() != null) milestone.setStatus(dto.getStatus());

        return toDTO(milestoneRepository.save(milestone));
    }

    @Transactional
    public void deleteMilestone(Long milestoneId, Long currentUserId) {
        Milestone milestone = findOrThrow(milestoneId);
        requireAtLeastMember(milestone.getProject().getTeam().getId(), currentUserId);
        milestoneRepository.delete(milestone);
    }

    @Transactional
    public void assignTaskToMilestone(Long taskId, Long milestoneId, Long currentUserId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        requireAtLeastMember(task.getProject().getTeam().getId(), currentUserId);

        if (milestoneId == null) {
            task.setMilestone(null);
        } else {
            Milestone milestone = findOrThrow(milestoneId);
            if (!task.getProject().getId().equals(milestone.getProject().getId())) {
                throw new ForbiddenException("Milestone does not belong to task project");
            }
            task.setMilestone(milestone);
        }
        taskRepository.save(task);
    }

    private Milestone findOrThrow(Long id) {
        return milestoneRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
    }

    private void requireAtLeastMember(Long teamId, Long userId) {
        var member = teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new ForbiddenException("User is not a member of this project"));
        int rank = switch (member.getRole()) {
            case OWNER  -> 4;
            case ADMIN  -> 3;
            case MEMBER -> 2;
            case VIEWER -> 1;
        };
        if (rank < 2) {
            throw new ForbiddenException("Insufficient permissions: MEMBER or above required");
        }
    }

    private MilestoneResponseDTO toDTO(Milestone m) {
        MilestoneResponseDTO dto = new MilestoneResponseDTO();
        dto.setId(m.getId());
        dto.setProjectId(m.getProject().getId());
        dto.setName(m.getName());
        dto.setDescription(m.getDescription());
        dto.setDueDate(m.getDueDate());
        dto.setStatus(m.getStatus());
        dto.setTaskCount(m.getTasks() != null ? m.getTasks().size() : 0L);
        dto.setCreatedAt(m.getCreatedAt());
        dto.setUpdatedAt(m.getUpdatedAt());
        return dto;
    }
}
