package com.planora.backend.service;

import com.planora.backend.dto.ProjectDTO;
import com.planora.backend.dto.ProjectResponseDTO; // Import your new DTO
import com.planora.backend.dto.UpdateProjectDTO;
import com.planora.backend.model.*;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.TeamRepository;
import com.planora.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;

    // ---------------- CREATE ----------------
    @Transactional
    public ProjectResponseDTO createProject(ProjectDTO dto) {
        Project project = new Project();
        project.setName(dto.getName());
        project.setDescription(dto.getDescription());
        project.setType(dto.getType());

        User owner = userRepository.findById(dto.getOwnerId())
                .orElseThrow(() -> new RuntimeException("Owner not found"));
        Team team = teamRepository.findById(dto.getTeamId())
                .orElseThrow(() -> new RuntimeException("Team not found"));

        project.setOwner(owner);
        project.setTeam(team);

        Project savedProject = projectRepository.save(project);
        return convertToResponseDTO(savedProject);
    }

    // ---------------- READ ALL ----------------
    public List<ProjectResponseDTO> getAllProjects() {
        return projectRepository.findAll()
                .stream()
                .map(this::convertToResponseDTO)
                .collect(Collectors.toList());
    }

    // ---------------- READ BY ID ----------------
    public ProjectResponseDTO getProjectById(Long id) {
        Project project = findProjectById(id);
        return convertToResponseDTO(project);
    }

    // ---------------- UPDATE ----------------
    @Transactional
    public ProjectResponseDTO updateProject(Long id, UpdateProjectDTO dto) {
        Project project = findProjectById(id);

        if (dto.getName() != null) project.setName(dto.getName());
        if (dto.getDescription() != null) project.setDescription(dto.getDescription());
        if (dto.getType() != null) project.setType(ProjectType.valueOf(dto.getType()));

        Project updatedProject = projectRepository.save(project);
        return convertToResponseDTO(updatedProject);
    }

    // ---------------- DELETE ----------------
    @Transactional
    public void deleteProject(Long projectId, Long teamId, Long userId) {
        Project project = findProjectById(projectId);
        validateOwnerPermission(teamId, userId);
        projectRepository.delete(project);
    }

    // =====================================================
    // HELPERS
    // =====================================================

    // Internal helper to get Entity (used by update/delete)
    private Project findProjectById(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project not found with id: " + id));
    }

    // Mapping logic: Entity -> DTO
    private ProjectResponseDTO convertToResponseDTO(Project project) {
        return ProjectResponseDTO.builder()
                .id(project.getId())
                .name(project.getName())
                .description(project.getDescription())
                .type(project.getType())
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .ownerId(project.getOwner().getUserId()) // Adjust if your User ID field name is different
                .ownerName(project.getOwner().getUsername())
                .teamId(project.getTeam().getId())
                .teamName(project.getTeam().getName())
                .build();
    }

    private void validateOwnerPermission(Long teamId, Long userId) {
        TeamMember member = teamMemberRepository
                .findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));

        if (member.getRole() != TeamRole.OWNER) {
            throw new RuntimeException("Only PROJECT OWNER can delete this project");
        }
    }
}