package com.planora.backend.service;

import com.planora.backend.dto.ProjectDTO;
import com.planora.backend.dto.ProjectResponseDTO; // Import your new DTO
import com.planora.backend.dto.UpdateProjectDTO;
import com.planora.backend.model.*;
import com.planora.backend.repository.ProjectAccessRepository;
import com.planora.backend.repository.ProjectFavoriteRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.TeamRepository;
import com.planora.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final ProjectAccessRepository projectAccessRepository;
    private final ProjectFavoriteRepository projectFavoriteRepository;

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
        return convertToResponseDTO(savedProject, dto.getOwnerId());
    }

    // ---------------- READ ALL (FOR AUTH USER) ----------------
    public List<ProjectResponseDTO> getProjectsForUser(Long userId) {
        List<Team> userTeams = teamMemberRepository.findByUserUserId(userId)
                .stream()
                .map(TeamMember::getTeam)
                .collect(Collectors.toList());

        if (userTeams.isEmpty()) {
            return java.util.Collections.emptyList();
        }

        List<Project> userProjects = projectRepository.findByTeamIn(userTeams);

        // Sort projects by last access time (ProjectAccess)
        return userProjects.stream()
                .sorted((p1, p2) -> {
                    LocalDateTime t1 = projectAccessRepository.findByProject_IdAndUser_UserId(p1.getId(), userId)
                            .map(ProjectAccess::getLastAccessedAt)
                            .orElse(p1.getCreatedAt() != null ? p1.getCreatedAt() : LocalDateTime.MIN);
                    LocalDateTime t2 = projectAccessRepository.findByProject_IdAndUser_UserId(p2.getId(), userId)
                            .map(ProjectAccess::getLastAccessedAt)
                            .orElse(p2.getCreatedAt() != null ? p2.getCreatedAt() : LocalDateTime.MIN);
                    return t2.compareTo(t1); // Descending order
                })
                .map(p -> convertToResponseDTO(p, userId))
                .collect(Collectors.toList());
    }

    @Transactional
    public void recordProjectAccess(Long projectId, Long userId) {
        Project project = findProjectById(projectId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        ProjectAccess access = projectAccessRepository.findByProject_IdAndUser_UserId(projectId, userId)
                .orElse(new ProjectAccess());
        
        access.setProject(project);
        access.setUser(user);
        // Explicitly update lastAccessedAt to mark entity as dirty, so Hibernate executes an UPDATE.
        access.setLastAccessedAt(LocalDateTime.now());
        projectAccessRepository.save(access);
    }

    @Transactional
    public void toggleFavorite(Long projectId, Long userId) {
        Project project = findProjectById(projectId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        projectFavoriteRepository.findByUserAndProject(user, project)
                .ifPresentOrElse(
                    projectFavoriteRepository::delete,
                    () -> {
                        ProjectFavorite favorite = new ProjectFavorite();
                        favorite.setProject(project);
                        favorite.setUser(user);
                        projectFavoriteRepository.save(favorite);
                    }
                );
    }

    // ---------------- READ RECENT (TOP N FOR AUTH USER) ----------------
    public List<ProjectResponseDTO> getRecentProjectsForUser(Long userId, int limit) {
        // Get the teams the user currently belongs to
        List<Team> userTeams = teamMemberRepository.findByUserUserId(userId)
                .stream().map(TeamMember::getTeam).collect(Collectors.toList());

        if (userTeams.isEmpty()) return java.util.Collections.emptyList();

        // Fetch the top-N most recently accessed project IDs
        List<ProjectAccess> recentAccesses = projectAccessRepository
                .findByUser_UserIdOrderByLastAccessedAtDesc(userId, PageRequest.of(0, limit * 3)); // fetch extra to allow for filtering

        if (recentAccesses.isEmpty()) {
            // Fall back to most recently created projects in user's teams
            return projectRepository.findByTeamIn(userTeams).stream()
                    .sorted((a, b) -> {
                        LocalDateTime ca = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.MIN;
                        LocalDateTime cb = b.getCreatedAt() != null ? b.getCreatedAt() : LocalDateTime.MIN;
                        return cb.compareTo(ca);
                    })
                    .limit(limit)
                    .map(p -> convertToResponseDTO(p, userId))
                    .collect(Collectors.toList());
        }

        // Filter: only include projects the user is still a team member of
        java.util.Set<Long> memberProjectIds = projectRepository.findByTeamIn(userTeams)
                .stream().map(Project::getId).collect(java.util.stream.Collectors.toSet());

        return recentAccesses.stream()
                .filter(access -> memberProjectIds.contains(access.getProject().getId()))
                .limit(limit)
                .map(access -> convertToResponseDTO(access.getProject(), userId))
                .collect(Collectors.toList());
    }

    // ---------------- READ FAVORITES (FOR AUTH USER) ----------------
    public List<ProjectResponseDTO> getFavoriteProjectsForUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Only return favourites from projects the user is still a team member of
        List<Team> userTeams = teamMemberRepository.findByUserUserId(userId)
                .stream().map(TeamMember::getTeam).collect(Collectors.toList());
        java.util.Set<Long> memberProjectIds = userTeams.isEmpty()
                ? java.util.Collections.emptySet()
                : projectRepository.findByTeamIn(userTeams).stream()
                        .map(Project::getId).collect(java.util.stream.Collectors.toSet());

        return projectFavoriteRepository.findByUserOrderByCreatedAtDesc(user).stream()
                .filter(fav -> memberProjectIds.contains(fav.getProject().getId()))
                .map(fav -> convertToResponseDTO(fav.getProject(), userId))
                .collect(Collectors.toList());
    }

    // ---------------- READ ALL (SYSTEM WIDE) ----------------
    public List<ProjectResponseDTO> getAllProjects() {
        return projectRepository.findAll()
                .stream()
                .map(p -> convertToResponseDTO(p, null))
                .collect(Collectors.toList());
    }

    // ---------------- READ BY ID ----------------
    public ProjectResponseDTO getProjectById(Long id) {
        Project project = findProjectById(id);
        return convertToResponseDTO(project, null);
    }

    // ---------------- READ BY ID (with user context for isFavorite) ----------------
    public ProjectResponseDTO getProjectByIdForUser(Long id, Long userId) {
        Project project = findProjectById(id);
        return convertToResponseDTO(project, userId);
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
        return convertToResponseDTO(updatedProject, null);
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
    private ProjectResponseDTO convertToResponseDTO(Project project, Long userId) {
        LocalDateTime lastAccessedAt = null;
        if (userId != null) {
            lastAccessedAt = projectAccessRepository
                    .findByProject_IdAndUser_UserId(project.getId(), userId)
                    .map(ProjectAccess::getLastAccessedAt)
                    .orElse(null);
        }

        return ProjectResponseDTO.builder()
                .id(project.getId())
                .name(project.getName())
                .projectKey(project.getProjectKey())
                .description(project.getDescription())
                .type(project.getType())
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .ownerId(project.getOwner().getUserId())
                .ownerName(project.getOwner().getUsername())
                .teamId(project.getTeam().getId())
                .teamName(project.getTeam().getName())
                .isFavorite(userId != null && projectFavoriteRepository.existsByUserAndProject(
                        userRepository.getReferenceById(userId), project))
                .lastAccessedAt(lastAccessedAt)
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