package com.planora.backend.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.planora.backend.model.Task;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.assignees LEFT JOIN FETCH t.labels WHERE t.project.id = :projectId")
    List<Task> findByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.assignees LEFT JOIN FETCH t.labels WHERE t.sprint.id = :sprintId")
    List<Task> findBySprintId(@Param("sprintId") Long sprintId);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.assignees LEFT JOIN FETCH t.labels WHERE t.sprint.id = :sprintId AND t.status = :status")
    List<Task> findBySprintIdAndStatus(@Param("sprintId") Long sprintId, @Param("status") String status);

    long countByAssigneeAndProject_TeamId(com.planora.backend.model.TeamMember assignee, Long teamId);

    @Query("SELECT t FROM Task t " +
           "WHERE t.assignee.user.userId = :userId " +
           "ORDER BY t.updatedAt DESC")
    List<Task> findByAssigneeUserUserIdOrderByUpdatedAtDesc(@Param("userId") Long userId, Pageable pageable);

    // "Worked On" — tasks this user was involved in (assigned or reported) and last modified by them
    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN t.assignee a " +
           "WHERE t.lastModifiedBy.userId = :userId OR a.user.userId = :userId " +
           "ORDER BY t.updatedAt DESC")
    List<Task> findTasksWorkedOnByUser(@Param("userId") Long userId, Pageable pageable);

    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.team pt " +
           "LEFT JOIN FETCH t.sprint s " +
           "LEFT JOIN FETCH t.assignee a " +
           "LEFT JOIN FETCH a.user au " +
           "LEFT JOIN FETCH t.reporter r " +
           "LEFT JOIN FETCH r.user ru " +
           "LEFT JOIN FETCH t.milestone m " +
           "LEFT JOIN FETCH t.kanbanColumn kc " +
           "LEFT JOIN FETCH t.assignees " +
           "LEFT JOIN FETCH t.labels " +
           "WHERE t.id = :taskId")
    java.util.Optional<Task> findByIdWithDetails(@Param("taskId") Long taskId);

    // Server-side filtered tasks for a project
    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.team pt " +
           "LEFT JOIN FETCH t.sprint s " +
           "LEFT JOIN FETCH t.assignee a " +
           "LEFT JOIN FETCH a.user au " +
           "LEFT JOIN FETCH t.reporter r " +
           "LEFT JOIN FETCH r.user ru " +
           "LEFT JOIN FETCH t.milestone m " +
           "LEFT JOIN FETCH t.kanbanColumn kc " +
           "LEFT JOIN FETCH t.assignees " +
           "LEFT JOIN FETCH t.labels " +
           "WHERE p.id = :projectId " +
           "AND (:status IS NULL OR t.status = :status) " +
           "AND (:assigneeId IS NULL OR au.userId = :assigneeId) " +
           "AND (:priority IS NULL OR CAST(t.priority AS string) = :priority) " +
           "AND (:sprintId IS NULL OR s.id = :sprintId) " +
           "ORDER BY t.createdAt DESC")
    List<Task> findByProjectIdFiltered(
            @Param("projectId") Long projectId,
            @Param("status") String status,
            @Param("assigneeId") Long assigneeId,
            @Param("priority") String priority,
            @Param("sprintId") Long sprintId);

    @Query("SELECT t FROM Task t WHERE LOWER(t.title) LIKE LOWER(CONCAT('%', :query, '%')) AND t.project.team.id IN (SELECT tm.team.id FROM TeamMember tm WHERE tm.user.userId = :userId)")
    List<Task> searchTasksByTitle(@Param("query") String query, @Param("userId") Long userId, Pageable pageable);

    /** Recurring tasks whose next spawn date is today or earlier and still active. */
    @Query("SELECT t FROM Task t WHERE t.nextOccurrence IS NOT NULL AND t.nextOccurrence <= :today AND t.recurrenceRule IS NOT NULL")
    List<Task> findByNextOccurrenceBeforeOrEqual(@Param("today") LocalDate today);
}
