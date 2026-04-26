package com.planora.backend.service;

import com.planora.backend.dto.ProjectDTO;
import com.planora.backend.dto.ProjectResponseDTO; 
import com.planora.backend.dto.UpdateProjectDTO;
import com.planora.backend.dto.ProjectMetricsDTO;
import com.planora.backend.exception.ConflictException;
import com.planora.backend.model.*;
import com.planora.backend.repository.ProjectAccessRepository;
import com.planora.backend.repository.ProjectFavoriteRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.TeamRepository;
import com.planora.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

@Service
@RequiredArgsConstructor
// Handles project creation, listing, updates, favorites, access tracking, and metrics.
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final ProjectAccessRepository projectAccessRepository;
    private final ProjectFavoriteRepository projectFavoriteRepository;
    private final SprintRepository sprintRepository;
    private final TaskRepository taskRepository;

    // Checks whether a project key is already in use.
    public boolean checkKeyExists(String key) {
        return projectRepository.existsByProjectKey(key);
    }

    // Creates a project, links it to a team, and assigns the logged-in user as owner.
    @Transactional
    public ProjectResponseDTO createProject(ProjectDTO dto) {
        Project project = new Project();
        project.setName(dto.getName());
        project.setProjectKey(dto.getProjectKey());
        project.setDescription(dto.getDescription());
        project.setType(dto.getType());

        // The controller sets ownerId from the authenticated user.
        User owner = userRepository.findById(dto.getOwnerId())
                .orElseThrow(() -> new RuntimeException("Owner not found"));

        // Decide whether to use an existing team or create a new one.
        // existing team
        Team team;
        if ("EXISTING".equalsIgnoreCase(dto.getTeamOption())) {
            if (dto.getTeamName() == null || dto.getTeamName().trim().isEmpty()) {
                throw new RuntimeException("Team name is required for existing team");
            }
            team = teamRepository.findByName(dto.getTeamName().trim())
                    .orElseThrow(() -> new RuntimeException("Team not found"));

            if (projectRepository.existsByProjectKeyAndTeamId(dto.getProjectKey(), team.getId())) {
                throw new ConflictException("Project key already in use");
            }

            // Make sure the user already belongs to that team.
            java.util.Optional<TeamMember> optMember = teamMemberRepository.findByTeamIdAndUserUserId(team.getId(),
                    owner.getUserId());
            if (optMember.isEmpty()) {
                throw new RuntimeException("You are not a member of this team");
            }
            // Promote the creator to OWNER if needed.
            TeamMember member = optMember.get();
            if (member.getRole() != TeamRole.OWNER) {
                member.setRole(TeamRole.OWNER);
                teamMemberRepository.save(member);
            }

            //new team 
        } else if ("NEW".equalsIgnoreCase(dto.getTeamOption())) {
            //team name required check
            if (dto.getTeamName() == null || dto.getTeamName().trim().isEmpty()) {
                throw new RuntimeException("Team name is required for new team");
            }
            //team name uniqueness check
            if (teamRepository.findByName(dto.getTeamName().trim()).isPresent()) {
                throw new RuntimeException("Team name already in use");
            }

            team = new Team();
            team.setName(dto.getTeamName().trim());
            team.setOwner(owner);
            team = teamRepository.save(team);

            if (projectRepository.existsByProjectKeyAndTeamId(dto.getProjectKey(), team.getId())) {
                throw new ConflictException("Project key already in use");
            }

            // Add the creator as the first member of the new team.
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
        if (ProjectType.AGILE.equals(savedProject.getType())) {
            // Agile projects start with Sprint 1.
            Sprint initialSprint = new Sprint();
            initialSprint.setProject(savedProject);
            initialSprint.setName(savedProject.getProjectKey() + " Sprint 1");
            initialSprint.setStatus(SprintStatus.NOT_STARTED);
            sprintRepository.save(initialSprint);
        }
        return convertToResponseDTO(savedProject, dto.getOwnerId());
    }

    // Returns all projects the user can access, with optional filter and sorting.
    @Transactional(readOnly = true)
    public List<ProjectResponseDTO> getProjectsForUser(Long userId, String type, String sort, String order) {
        List<TeamMember> memberships = teamMemberRepository.findByUserUserId(userId);
        List<Team> userTeams = memberships.stream()
                .map(TeamMember::getTeam)
                .collect(Collectors.toList());

        if (userTeams.isEmpty()) {
            return java.util.Collections.emptyList();
        }

        List<Project> userProjects = projectRepository.findByTeamIn(userTeams);

        String normalizedType = type == null ? null : type.trim();
        String normalizedSort = sort == null ? "lastAccessedAt" : sort.trim();
        String normalizedOrder = order == null ? "desc" : order.trim();

        boolean asc = "asc".equalsIgnoreCase(normalizedOrder);

        Comparator<ProjectResponseDTO> comparator;
        if ("name".equalsIgnoreCase(normalizedSort)) {
            comparator = Comparator.comparing(
                dto -> dto.getName() == null ? "" : dto.getName(),
                String.CASE_INSENSITIVE_ORDER);
        } else if ("updatedAt".equalsIgnoreCase(normalizedSort)) {
            comparator = Comparator.comparing(
                dto -> dto.getUpdatedAt() == null ? LocalDateTime.MIN : dto.getUpdatedAt());
        } else if ("type".equalsIgnoreCase(normalizedSort)) {
            comparator = Comparator.comparing(
                dto -> dto.getType() == null ? "" : dto.getType().name(),
                String.CASE_INSENSITIVE_ORDER);
        } else {
            comparator = Comparator.comparing(
                dto -> dto.getLastAccessedAt() == null ? LocalDateTime.MIN : dto.getLastAccessedAt());
        }

        if (!asc) {
            comparator = comparator.reversed();
        }

        
        // Load related data once to avoid repeated database calls.
        User userRef = userRepository.getReferenceById(userId);

        java.util.Map<Long, LocalDateTime> teamJoinedMap = memberships.stream()
            .collect(Collectors.toMap(m -> m.getTeam().getId(), TeamMember::getJoinedAt, (a, b) -> a));
            
        java.util.Map<Long, LocalDateTime> accessMap = projectAccessRepository.findByUser_UserIdOrderByLastAccessedAtDesc(userId, Pageable.unpaged()).stream()
            .collect(Collectors.toMap(a -> a.getProject().getId(), ProjectAccess::getLastAccessedAt, (a, b) -> a));
            
        java.util.Map<Long, LocalDateTime> favoriteMap = projectFavoriteRepository.findByUserOrderByCreatedAtDesc(userRef).stream()
            .collect(Collectors.toMap(f -> f.getProject().getId(), ProjectFavorite::getCreatedAt, (a, b) -> a));

        return userProjects.stream()
            .map(p -> convertToResponseDTO(p, userId, teamJoinedMap, accessMap, favoriteMap))
            .filter(dto -> normalizedType == null || normalizedType.isEmpty() ||
                (dto.getType() != null && dto.getType().name().equalsIgnoreCase(normalizedType)))
            .sorted(comparator)
            .collect(Collectors.toList());
    }

    @Transactional
    public void recordProjectAccess(Long projectId, Long userId) {
        // Saves the latest access time so recent-project lists stay accurate.
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
        // Adds the project to favorites if missing, otherwise removes it.
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

    // Returns the most recently accessed projects for the user.
    @Transactional(readOnly = true)
    public List<ProjectResponseDTO> getRecentProjectsForUser(Long userId, int limit) {
        // Find all teams the user belongs to.
        List<TeamMember> memberships = teamMemberRepository.findByUserUserId(userId);
        List<Team> userTeams = memberships.stream().map(TeamMember::getTeam).collect(Collectors.toList());

        if (userTeams.isEmpty()) return java.util.Collections.emptyList();

        // Load all projects from those teams, then sort by recent access.
        List<Project> allMemberProjects = projectRepository.findByTeamIn(userTeams);

        // Load related data once to keep the query count low.
        User userRef = userRepository.getReferenceById(userId);

        java.util.Map<Long, LocalDateTime> teamJoinedMap = memberships.stream()
            .collect(Collectors.toMap(m -> m.getTeam().getId(), TeamMember::getJoinedAt, (a, b) -> a));
            
        java.util.Map<Long, LocalDateTime> accessMap = projectAccessRepository.findByUser_UserIdOrderByLastAccessedAtDesc(userId, Pageable.unpaged()).stream()
            .collect(Collectors.toMap(a -> a.getProject().getId(), ProjectAccess::getLastAccessedAt, (a, b) -> a));
            
        java.util.Map<Long, LocalDateTime> favoriteMap = projectFavoriteRepository.findByUserOrderByCreatedAtDesc(userRef).stream()
            .collect(Collectors.toMap(f -> f.getProject().getId(), ProjectFavorite::getCreatedAt, (a, b) -> a));

        // Sort by last access time, newest first.
        return allMemberProjects.stream()
                .map(p -> convertToResponseDTO(p, userId, teamJoinedMap, accessMap, favoriteMap))
                .sorted((d1, d2) -> {
                    LocalDateTime t1 = d1.getLastAccessedAt() != null ? d1.getLastAccessedAt() : LocalDateTime.MIN;
                    LocalDateTime t2 = d2.getLastAccessedAt() != null ? d2.getLastAccessedAt() : LocalDateTime.MIN;
                    return t2.compareTo(t1); // Descending order
                })
                .limit(limit)
                .collect(Collectors.toList());
    }

    // Returns only the user's favorite projects that are still accessible.
    @Transactional(readOnly = true)
    public List<ProjectResponseDTO> getFavoriteProjectsForUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Keep only favorites that belong to teams the user still has access to.
        List<TeamMember> memberships = teamMemberRepository.findByUserUserId(userId);
        List<Team> userTeams = memberships.stream().map(TeamMember::getTeam).collect(Collectors.toList());
        java.util.Set<Long> memberProjectIds = userTeams.isEmpty()
                ? java.util.Collections.emptySet()
                : projectRepository.findByTeamIn(userTeams).stream()
                        .map(Project::getId).collect(java.util.stream.Collectors.toSet());

        // Load access timestamps once for efficient DTO mapping.
        java.util.Map<Long, LocalDateTime> teamJoinedMap = memberships.stream()
            .collect(Collectors.toMap(m -> m.getTeam().getId(), TeamMember::getJoinedAt, (a, b) -> a));
            
        java.util.Map<Long, LocalDateTime> accessMap = projectAccessRepository.findByUser_UserIdOrderByLastAccessedAtDesc(userId, Pageable.unpaged()).stream()
            .collect(Collectors.toMap(a -> a.getProject().getId(), ProjectAccess::getLastAccessedAt, (a, b) -> a));

        // Reuse the favorite list for both mapping and filtering.
        List<ProjectFavorite> favorites = projectFavoriteRepository.findByUserOrderByCreatedAtDesc(user);
        java.util.Map<Long, LocalDateTime> favoriteMap = favorites.stream()
            .collect(Collectors.toMap(f -> f.getProject().getId(), ProjectFavorite::getCreatedAt, (a, b) -> a));

        return favorites.stream()
                .filter(fav -> memberProjectIds.contains(fav.getProject().getId()))
                .map(fav -> convertToResponseDTO(fav.getProject(), userId, teamJoinedMap, accessMap, favoriteMap))
                .collect(Collectors.toList());
    }

    // Returns every project in the system.
    @Transactional(readOnly = true)
    public List<ProjectResponseDTO> getAllProjects() {
        return projectRepository.findAll()
                .stream()
                .map(p -> convertToResponseDTO(p, null))
                .collect(Collectors.toList());
    }

    // Returns a single project without user-specific flags.
    @Transactional(readOnly = true)
    public ProjectResponseDTO getProjectById(Long id) {
        Project project = findProjectById(id);
        return convertToResponseDTO(project, null);
    }

    // Returns a single project and includes user-specific data like favorite state.
    @Transactional(readOnly = true)
    public ProjectResponseDTO getProjectByIdForUser(Long id, Long userId) {
        Project project = findProjectById(id);
        return convertToResponseDTO(project, userId);
    }

    // Updates the fields provided in the request.
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

    // Deletes a project after owner permission is verified.
    @Transactional
    public void deleteProject(Long projectId, Long teamId, Long userId) {
        Project project = findProjectById(projectId);
        validateOwnerPermission(teamId, userId);
        projectRepository.delete(project);
    }

    // =====================================================
    // HELPERS
    // =====================================================

    // Loads a project entity or throws a clear error if it does not exist.
    private Project findProjectById(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project not found with id: " + id));
    }

    // Converts an entity into the response DTO used by the frontend.
    private ProjectResponseDTO convertToResponseDTO(Project project, Long userId) {
        return convertToResponseDTO(project, userId, null, null, null);
    }

    // Builds the response DTO and fills in user-specific fields when available.
    private ProjectResponseDTO convertToResponseDTO(Project project, Long userId,
            java.util.Map<Long, LocalDateTime> teamJoinedMap,
            java.util.Map<Long, LocalDateTime> accessMap,
            java.util.Map<Long, LocalDateTime> favoriteMap) {
        LocalDateTime lastAccessedAt = null;
        LocalDateTime favoriteMarkedAt = null;
        if (userId != null) {
            // Prefer cached maps first, then fall back to direct repository calls.
            if (accessMap != null) {
                lastAccessedAt = accessMap.get(project.getId());
                if (lastAccessedAt == null && teamJoinedMap != null) {
                    lastAccessedAt = teamJoinedMap.get(project.getTeam().getId());
                }
            } else {
                lastAccessedAt = projectAccessRepository
                        .findByProject_IdAndUser_UserId(project.getId(), userId)
                        .map(ProjectAccess::getLastAccessedAt)
                        .orElseGet(() -> teamMemberRepository
                                .findByTeamIdAndUserUserId(project.getTeam().getId(), userId)
                                .map(TeamMember::getJoinedAt)
                                .orElse(null));
            }

            if (favoriteMap != null) {
                favoriteMarkedAt = favoriteMap.get(project.getId());
            } else {
                favoriteMarkedAt = projectFavoriteRepository
                    .findByUserAndProject(userRepository.getReferenceById(userId), project)
                    .map(ProjectFavorite::getCreatedAt)
                    .orElse(null);
            }
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
                .isFavorite(favoriteMarkedAt != null)
                .favoriteMarkedAt(favoriteMarkedAt)
                .lastAccessedAt(lastAccessedAt)
                .build();
    }

    // Returns project-level metrics such as task counts and sprint health.
    @Transactional(readOnly = true)
    public ProjectMetricsDTO getProjectMetrics(Long projectId) {
        Project project = findProjectById(projectId);

        List<Task> allTasks = taskRepository.findByProjectId(projectId);

        // Total tasks in the project.
        Long totalTasks = (long) allTasks.size();

        // Tasks marked as done.
        Long completedTasks = allTasks.stream()
            .filter(task -> "DONE".equalsIgnoreCase(task.getStatus()))
            .count();

        // Tasks that are overdue and still not completed.
        LocalDate today = LocalDate.now();
        Long overdueTasks = allTasks.stream()
            .filter(task -> task.getDueDate() != null
                && task.getDueDate().isBefore(today)
                && !"DONE".equalsIgnoreCase(task.getStatus()))
                .count();

        // Number of members in the project team.
        Long memberCount = (long) teamMemberRepository.findByTeamId(project.getTeam().getId()).size();

        // Find the active sprint and estimate sprint health.
        Sprint activeSprint = sprintRepository.findByProject_Id(projectId).stream()
            .filter(sprint -> sprint.getStatus() == SprintStatus.ACTIVE)
            .findFirst()
                .orElse(null);

        Integer sprintHealth = 0;
        Long activeSprintId = null;
        if (activeSprint != null) {
            activeSprintId = activeSprint.getId();
            List<Task> sprintTasksList = taskRepository.findBySprintId(activeSprint.getId());
            Long sprintTasks = (long) sprintTasksList.size();
            Long sprintCompleted = sprintTasksList.stream()
                .filter(task -> "DONE".equalsIgnoreCase(task.getStatus()))
                .count();
            sprintHealth = sprintTasks > 0 ? (int) ((sprintCompleted * 100) / sprintTasks) : 0;
        }

        return ProjectMetricsDTO.builder()
                .totalTasks(totalTasks)
                .completedTasks(completedTasks)
                .overdueTasks(overdueTasks)
                .memberCount(memberCount)
                .sprintHealth(sprintHealth)
                .activeSprintId(activeSprintId)
                .build();
    }

    // Only project owners can delete a project.
    private void validateOwnerPermission(Long teamId, Long userId) {
        TeamMember member = teamMemberRepository
                .findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));

        if (member.getRole() != TeamRole.OWNER) {
            throw new RuntimeException("Only PROJECT OWNER can delete this project");
        }
    }
}