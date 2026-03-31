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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;

    public boolean checkKeyExists(String key) {
        return projectRepository.existsByProjectKey(key);
    }

    // ---------------- CREATE ----------------
    @Transactional
    public ProjectResponseDTO createProject(ProjectDTO dto) {
        if (projectRepository.existsByProjectKey(dto.getProjectKey())) {
            throw new RuntimeException("Project key already in use");
        }

        Project project = new Project();
        project.setName(dto.getName());
        project.setProjectKey(dto.getProjectKey());
        project.setDescription(dto.getDescription());
        project.setType(dto.getType());

        User owner = userRepository.findById(dto.getOwnerId())
                .orElseThrow(() -> new RuntimeException("Owner not found"));

        Team team;
        if ("EXISTING".equalsIgnoreCase(dto.getTeamOption())) {
            if (dto.getTeamName() == null || dto.getTeamName().trim().isEmpty()) {
                throw new RuntimeException("Team name is required for existing team");
            }
            team = teamRepository.findByName(dto.getTeamName().trim())
                    .orElseThrow(() -> new RuntimeException("Team not found"));

            // Verify user is in the team
            java.util.Optional<TeamMember> optMember = teamMemberRepository.findByTeamIdAndUserUserId(team.getId(),
                    owner.getUserId());
            if (optMember.isEmpty()) {
                throw new RuntimeException("You are not a member of this team");
            }
            // Ensure creator has OWNER role for the project context or upgrade them if
            // missing, but typically we just verify membership.
            // Let's upgrade them to OWNER or leave as is based on existing logic
            // constraint:
            TeamMember member = optMember.get();
            if (member.getRole() != TeamRole.OWNER) {
                member.setRole(TeamRole.OWNER);
                teamMemberRepository.save(member);
            }

        } else if ("NEW".equalsIgnoreCase(dto.getTeamOption())) {
            if (dto.getTeamName() == null || dto.getTeamName().trim().isEmpty()) {
                throw new RuntimeException("Team name is required for new team");
            }
            if (teamRepository.findByName(dto.getTeamName().trim()).isPresent()) {
                throw new RuntimeException("Team name already in use");
            }
            team = new Team();
            team.setName(dto.getTeamName().trim());
            team.setOwner(owner);
            team = teamRepository.save(team);

            // Add owner as TeamMember
            TeamMember newMember = new TeamMember();
            newMember.setTeam(team);
            newMember.setUser(owner);
            newMember.setRole(TeamRole.OWNER);
            teamMemberRepository.save(newMember);
        } else {
            throw new RuntimeException("Invalid team option");
        }

        project.setOwner(owner);
        project.setTeam(team);

        Project savedProject = projectRepository.save(project);
        return convertToResponseDTO(savedProject);
    }

    // ---------------- READ ALL ----------------
    public List<ProjectResponseDTO> getAllProjects(Long currentUserId) {
        Set<Long> projectIds = new LinkedHashSet<>();

        teamMemberRepository.findByUserUserId(currentUserId)
                .forEach(member -> member.getTeam().getProjects().forEach(project -> projectIds.add(project.getId())));

        return projectIds.stream()
                .map(this::findProjectById)
                .map(this::convertToResponseDTO)
                .collect(Collectors.toList());
    }

    // ---------------- READ BY ID ----------------
    public ProjectResponseDTO getProjectById(Long id, Long currentUserId) {
        Project project = findProjectById(id);
        validateMembership(project.getTeam().getId(), currentUserId);
        return convertToResponseDTO(project);
    }

    // ---------------- UPDATE ----------------
    @Transactional
    public ProjectResponseDTO updateProject(Long id, UpdateProjectDTO dto) {
        Project project = findProjectById(id);

        if (dto.getName() != null)
            project.setName(dto.getName());
        if (dto.getDescription() != null)
            project.setDescription(dto.getDescription());
        if (dto.getType() != null)
            project.setType(ProjectType.valueOf(dto.getType()));

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
                .projectKey(project.getProjectKey())
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

    private void validateMembership(Long teamId, Long userId) {
        teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new AccessDeniedException("Access denied: You are not a member of this team"));
    }
}