package com.planora.backend.service;

import com.planora.backend.dto.GlobalSearchResponseDTO;
import com.planora.backend.model.*;
import com.planora.backend.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GlobalSearchService {

    private final TaskRepository taskRepository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final TeamMemberRepository teamMemberRepository;
        private final ProjectRepository projectRepository;

        @PersistenceContext
        private EntityManager entityManager;

    /**
     * Global search across tasks, documents, and members.
     * Query filter: searches tasks by title/description, documents by title, members by name/email.
     * ProjectId filter: if provided, limits to tasks and documents in that project.
     */
    public GlobalSearchResponseDTO search(String query, Long projectId, Long currentUserId) {
        String normalizedQuery = query == null ? "" : query.trim();
        if (normalizedQuery.length() < 2) {
            return GlobalSearchResponseDTO.builder()
                    .tasks(List.of())
                    .documents(List.of())
                    .members(List.of())
                    .build();
        }

        List<Long> projectIds = resolveProjectScope(projectId, currentUserId);
        if (projectIds.isEmpty()) {
            return GlobalSearchResponseDTO.builder()
                    .tasks(List.of())
                    .documents(List.of())
                    .members(List.of())
                    .projects(List.of())
                    .build();
        }

        // Search tasks - visible to user in accessible projects
        List<GlobalSearchResponseDTO.TaskSearchResultDTO> tasks = searchTasks(
                normalizedQuery, projectIds);

        // Search documents - visible to user in accessible projects
        List<GlobalSearchResponseDTO.DocumentSearchResultDTO> documents = searchDocuments(
                normalizedQuery, projectIds);

        // Search members - across the system (members current user can see)
        List<GlobalSearchResponseDTO.MemberSearchResultDTO> members = searchMembers(
                normalizedQuery, projectIds);

        // Search projects (boards) - visible to user
        List<GlobalSearchResponseDTO.ProjectSearchResultDTO> projects = searchProjects(
                normalizedQuery, projectIds);

        return GlobalSearchResponseDTO.builder()
                .tasks(tasks)
                .documents(documents)
                .members(members)
                .projects(projects)
                .build();
    }

    /**
     * Search tasks by title or description.
     */
    private List<GlobalSearchResponseDTO.TaskSearchResultDTO> searchTasks(
            String query, List<Long> projectIds) {
        List<Task> results = entityManager.createQuery(
                        "SELECT t FROM Task t " +
                                "WHERE t.project.id IN :projectIds " +
                                "AND (LOWER(t.title) LIKE LOWER(CONCAT('%', :q, '%')) " +
                                "OR LOWER(COALESCE(t.description, '')) LIKE LOWER(CONCAT('%', :q, '%'))) " +
                                "ORDER BY t.updatedAt DESC",
                        Task.class)
                .setParameter("projectIds", projectIds)
                .setParameter("q", query)
                .setMaxResults(5)
                .getResultList();

        return results.stream()
                .map(task -> GlobalSearchResponseDTO.TaskSearchResultDTO.builder()
                        .id(task.getId())
                        .title(task.getTitle())
                        .subtitle(task.getProject().getName() + " • " + Objects.toString(task.getStatus(), "UNKNOWN"))
                        .projectName(task.getProject().getName())
                        .status(Objects.toString(task.getStatus(), "UNKNOWN"))
                        .url("/backlog?projectId=" + task.getProject().getId() + "&taskId=" + task.getId())
                        .type(GlobalSearchResponseDTO.SearchResultType.TASK)
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * Search documents by title.
     */
    private List<GlobalSearchResponseDTO.DocumentSearchResultDTO> searchDocuments(
            String query, List<Long> projectIds) {
        List<Document> results = entityManager.createQuery(
                        "SELECT d FROM Document d " +
                                "WHERE d.project.id IN :projectIds " +
                                "AND LOWER(d.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
                                "ORDER BY d.updatedAt DESC",
                        Document.class)
                .setParameter("projectIds", projectIds)
                .setParameter("q", query)
                .setMaxResults(5)
                .getResultList();

        return results.stream()
                .map(doc -> GlobalSearchResponseDTO.DocumentSearchResultDTO.builder()
                        .id(doc.getId())
                        .title(doc.getName())
                        .subtitle(doc.getProject().getName())
                        .url("/folders?projectId=" + doc.getProject().getId() + "&documentId=" + doc.getId())
                        .type(GlobalSearchResponseDTO.SearchResultType.DOCUMENT)
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * Search members by name or email.
     */
    private List<GlobalSearchResponseDTO.MemberSearchResultDTO> searchMembers(
            String query, List<Long> projectIds) {
        List<TeamMember> teamMembers = entityManager.createQuery(
                        "SELECT tm FROM TeamMember tm " +
                                "WHERE tm.team.id IN (SELECT p.team.id FROM Project p WHERE p.id IN :projectIds) " +
                                "AND (LOWER(COALESCE(tm.user.fullName, tm.user.username)) LIKE LOWER(CONCAT('%', :q, '%')) " +
                                "OR LOWER(tm.user.email) LIKE LOWER(CONCAT('%', :q, '%'))) " +
                                "ORDER BY tm.user.username ASC",
                        TeamMember.class)
                .setParameter("projectIds", projectIds)
                .setParameter("q", query)
                .setMaxResults(5)
                .getResultList();

        return teamMembers.stream()
                .map(tm -> GlobalSearchResponseDTO.MemberSearchResultDTO.builder()
                        .id(tm.getUser().getUserId())
                        .name(tm.getUser().getFullName() != null && !tm.getUser().getFullName().isBlank()
                                ? tm.getUser().getFullName()
                                : tm.getUser().getUsername())
                        .subtitle(tm.getRole().name() + " • " + tm.getUser().getEmail())
                        .url("/profile?userId=" + tm.getUser().getUserId())
                        .type(GlobalSearchResponseDTO.SearchResultType.MEMBER)
                        .build())
                .distinct()
                .collect(Collectors.toList());
    }

    /**
     * Search projects by name.
     */
    private List<GlobalSearchResponseDTO.ProjectSearchResultDTO> searchProjects(
            String query, List<Long> projectIds) {
        List<Project> projects = entityManager.createQuery(
                        "SELECT p FROM Project p " +
                                "WHERE p.id IN :projectIds " +
                                "AND LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
                                "ORDER BY p.updatedAt DESC",
                        Project.class)
                .setParameter("projectIds", projectIds)
                .setParameter("q", query)
                .setMaxResults(5)
                .getResultList();

        return projects.stream()
                .map(p -> GlobalSearchResponseDTO.ProjectSearchResultDTO.builder()
                        .id(p.getId())
                        .title(p.getName())
                        .subtitle(p.getType().name() + " Project")
                        .url("/summary/" + p.getId())
                        .type(GlobalSearchResponseDTO.SearchResultType.PROJECT)
                        .build())
                .collect(Collectors.toList());
    }

    private List<Long> resolveProjectScope(Long projectId, Long userId) {
        List<Long> accessibleProjectIds = teamMemberRepository.findByUserUserId(userId)
                .stream()
                .flatMap(tm -> projectRepository.findByTeamIn(List.of(tm.getTeam())).stream())
                .map(Project::getId)
                .distinct()
                .collect(Collectors.toList());

        if (projectId == null) {
            return accessibleProjectIds;
        }

        return accessibleProjectIds.contains(projectId) ? List.of(projectId) : List.of();
    }
}
