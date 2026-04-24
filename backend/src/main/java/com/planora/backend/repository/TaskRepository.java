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
    @Query("SELECT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.team pt " +
           "LEFT JOIN FETCH t.sprint " +
           "LEFT JOIN FETCH t.assignee a " +
           "LEFT JOIN FETCH a.user " +
           "LEFT JOIN FETCH t.reporter r " +
           "LEFT JOIN FETCH r.user " +
           "LEFT JOIN FETCH t.milestone " +
           "LEFT JOIN FETCH t.lastModifiedBy " +
           "WHERE t.project.id = :projectId " +
           "ORDER BY " +
           "CASE WHEN t.sprint IS NULL THEN 0 ELSE 1 END, " +
           "CASE WHEN t.sprint IS NULL THEN t.backlogPosition ELSE t.sprintPosition END, " +
           "t.id")
    List<Task> findByProjectIdWithScalars(@Param("projectId") Long projectId);

    @EntityGraph(attributePaths = {"labels", "assignees", "assignees.user", "subTasks", "attachments"})
    @Query("SELECT DISTINCT t FROM Task t WHERE t.id IN :ids")
    List<Task> findByIdInWithCollections(@Param("ids") List<Long> ids);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.assignees LEFT JOIN FETCH t.labels WHERE t.project.id = :projectId")
    List<Task> findByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.team pt " +
           "LEFT JOIN FETCH t.sprint " +
           "LEFT JOIN FETCH t.assignee a " +
           "LEFT JOIN FETCH a.user " +
           "LEFT JOIN FETCH t.reporter r " +
           "LEFT JOIN FETCH r.user " +
           "LEFT JOIN FETCH t.milestone " +
           "LEFT JOIN FETCH t.lastModifiedBy " +
           "WHERE t.sprint.id = :sprintId")
    List<Task> findBySprintIdWithScalars(@Param("sprintId") Long sprintId);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.assignees LEFT JOIN FETCH t.labels WHERE t.sprint.id = :sprintId")
    List<Task> findBySprintId(@Param("sprintId") Long sprintId);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.assignees LEFT JOIN FETCH t.labels WHERE t.sprint.id = :sprintId AND t.status = :status")
    List<Task> findBySprintIdAndStatus(@Param("sprintId") Long sprintId, @Param("status") String status);

    long countByAssigneeAndProject_TeamId(com.planora.backend.model.TeamMember assignee, Long teamId);

    @Query("""
           SELECT a.user.userId, COUNT(t.id)
           FROM Task t
           JOIN t.assignee a
           WHERE a.user.userId IN :userIds
             AND t.project.team.id = :teamId
           GROUP BY a.user.userId
           """)
    List<Object[]> countTasksByAssigneeUserIdsAndTeamId(@Param("userIds") List<Long> userIds,
                                                        @Param("teamId") Long teamId);

    @Query("SELECT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.team pt " +
           "LEFT JOIN FETCH t.assignee a " +
           "LEFT JOIN FETCH a.user au " +
           "LEFT JOIN FETCH t.reporter r " +
           "LEFT JOIN FETCH r.user ru " +
           "LEFT JOIN FETCH t.sprint s " +
           "LEFT JOIN FETCH t.milestone m " +
           "WHERE t.assignee.user.userId = :userId " +
           "ORDER BY t.updatedAt DESC")
    List<Task> findByAssigneeUserUserIdOrderByUpdatedAtDesc(@Param("userId") Long userId, Pageable pageable);

    // "Worked On" — tasks this user was involved in (assigned or reported) and last modified by them
    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.team pt " +
           "LEFT JOIN FETCH t.assignee a2 " +
           "LEFT JOIN FETCH a2.user au " +
           "LEFT JOIN FETCH t.reporter r " +
           "LEFT JOIN FETCH r.user ru " +
           "LEFT JOIN FETCH t.sprint s " +
           "LEFT JOIN FETCH t.milestone m " +
           "LEFT JOIN t.assignee a " +
           "WHERE t.lastModifiedBy.userId = :userId OR a.user.userId = :userId " +
           "ORDER BY t.updatedAt DESC")
    List<Task> findTasksWorkedOnByUser(@Param("userId") Long userId, Pageable pageable);

    @Query("SELECT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.team pt " +
           "WHERE t.id = :taskId")
    java.util.Optional<Task> findByIdWithProjectTeam(@Param("taskId") Long taskId);

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
    @Query("SELECT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.team pt " +
           "LEFT JOIN FETCH t.sprint s " +
           "LEFT JOIN FETCH t.assignee a " +
           "LEFT JOIN FETCH a.user au " +
           "LEFT JOIN FETCH t.reporter r " +
           "LEFT JOIN FETCH r.user ru " +
           "LEFT JOIN FETCH t.milestone m " +
           "LEFT JOIN FETCH t.kanbanColumn kc " +
           "WHERE p.id = :projectId " +
           "AND (:status IS NULL OR t.status = :status) " +
           "AND (:assigneeId IS NULL OR au.userId = :assigneeId) " +
           "AND (:priority IS NULL OR CAST(t.priority AS string) = :priority) " +
           "AND (:sprintId IS NULL OR s.id = :sprintId) " +
           "AND (:milestoneId IS NULL OR m.id = :milestoneId) " +
           "ORDER BY " +
           "CASE WHEN t.sprint IS NULL THEN 0 ELSE 1 END, " +
           "CASE WHEN t.sprint IS NULL THEN t.backlogPosition ELSE t.sprintPosition END, " +
           "t.id")
    List<Task> findByProjectIdFiltered(
            @Param("projectId") Long projectId,
            @Param("status") String status,
            @Param("assigneeId") Long assigneeId,
            @Param("priority") String priority,
            @Param("sprintId") Long sprintId,
            @Param("milestoneId") Long milestoneId);

    @Query("SELECT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "WHERE LOWER(t.title) LIKE LOWER(CONCAT('%', :query, '%')) " +
           "AND t.project.team.id IN (SELECT tm.team.id FROM TeamMember tm WHERE tm.user.userId = :userId)")
    List<Task> searchTasksByTitle(@Param("query") String query, @Param("userId") Long userId, Pageable pageable);

    /** Recurring tasks whose next spawn date is today or earlier and still active. */
    @Query("SELECT t FROM Task t " +
           "LEFT JOIN FETCH t.project " +
           "LEFT JOIN FETCH t.sprint " +
           "LEFT JOIN FETCH t.kanbanColumn " +
           "LEFT JOIN FETCH t.assignee a " +
           "LEFT JOIN FETCH a.user " +
           "LEFT JOIN FETCH t.reporter r " +
           "LEFT JOIN FETCH r.user " +
           "LEFT JOIN FETCH t.milestone " +
           "WHERE t.nextOccurrence IS NOT NULL AND t.nextOccurrence <= :today AND t.recurrenceRule IS NOT NULL")
    List<Task> findByNextOccurrenceBeforeOrEqualWithAssociations(@Param("today") LocalDate today);

    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.team pt " +
           "LEFT JOIN FETCH t.sprint s " +
           "LEFT JOIN FETCH t.assignee a " +
           "LEFT JOIN FETCH a.user au " +
           "LEFT JOIN FETCH t.reporter r " +
           "LEFT JOIN FETCH r.user ru " +
           "WHERE t.id IN :ids")
    List<Task> findByIdInWithDetails(@Param("ids") List<Long> ids);

    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.team pt " +
           "LEFT JOIN FETCH t.sprint s " +
           "LEFT JOIN FETCH t.assignee a " +
           "LEFT JOIN FETCH a.user au " +
           "LEFT JOIN FETCH t.reporter r " +
           "LEFT JOIN FETCH r.user ru " +
           "LEFT JOIN FETCH t.milestone m " +
           "LEFT JOIN FETCH t.lastModifiedBy " +
           "WHERE t.id IN :ids")
    List<Task> findByIdInWithScalars(@Param("ids") List<Long> ids);

    @Query("SELECT t.id FROM Task t " +
           "WHERE t.assignee.user.userId = :userId " +
           "ORDER BY t.updatedAt DESC")
    List<Long> findAssignedTaskIdsByUser(@Param("userId") Long userId, Pageable pageable);

    @Query("SELECT t.id FROM Task t " +
           "LEFT JOIN t.assignee a " +
           "WHERE t.lastModifiedBy.userId = :userId OR a.user.userId = :userId " +
           "GROUP BY t.id, t.updatedAt " +
           "ORDER BY t.updatedAt DESC")
    List<Long> findWorkedOnTaskIdsByUser(@Param("userId") Long userId, Pageable pageable);

    @Query("SELECT t.sprint.id, SUM(t.storyPoint), " +
           "SUM(CASE WHEN UPPER(t.status) = 'DONE' THEN t.storyPoint ELSE 0 END) " +
           "FROM Task t WHERE t.sprint.id IN :sprintIds GROUP BY t.sprint.id")
    List<Object[]> aggregateVelocityBySprintIds(@Param("sprintIds") List<Long> sprintIds);

    @Query("SELECT t.id, d.id, d.title FROM Task t LEFT JOIN t.dependencies d WHERE t.id IN :taskIds")
    List<Object[]> findDependencyRowsByTaskIds(@Param("taskIds") List<Long> taskIds);

    @Query("SELECT COALESCE(MAX(t.projectTaskNumber), 0) FROM Task t WHERE t.project.id = :projectId")
    Long findMaxProjectTaskNumberByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT COALESCE(MAX(t.backlogPosition), -1) FROM Task t WHERE t.project.id = :projectId AND t.sprint IS NULL")
    Integer findMaxBacklogPositionByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT COALESCE(MAX(t.sprintPosition), -1) FROM Task t WHERE t.sprint.id = :sprintId")
    Integer findMaxSprintPositionBySprintId(@Param("sprintId") Long sprintId);

    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.owner po " +
           "LEFT JOIN FETCH t.assignee a " +
           "LEFT JOIN FETCH a.user au " +
           "LEFT JOIN FETCH t.assignees tas " +
           "LEFT JOIN FETCH tas.user tau " +
           "WHERE t.dueDate IS NOT NULL " +
           "AND UPPER(COALESCE(t.status, '')) <> 'DONE' " +
           "AND t.dueDate <= :maxDueDate")
    List<Task> findOpenTasksDueOnOrBeforeWithReminderRelations(@Param("maxDueDate") LocalDate maxDueDate);
}
