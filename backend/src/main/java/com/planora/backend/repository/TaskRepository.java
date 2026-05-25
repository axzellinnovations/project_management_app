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
    @Query("""
           SELECT t FROM Task t
           LEFT JOIN FETCH t.project p
           LEFT JOIN FETCH p.team
           LEFT JOIN FETCH t.sprint
           LEFT JOIN FETCH t.assignee a
           LEFT JOIN FETCH a.user
           LEFT JOIN FETCH t.reporter r
           LEFT JOIN FETCH r.user
           LEFT JOIN FETCH t.milestone
           LEFT JOIN FETCH t.lastModifiedBy
           WHERE t.project.id = :projectId
             AND t.archived = false
           ORDER BY
             CASE WHEN t.sprint IS NULL THEN 0 ELSE 1 END,
             CASE WHEN t.sprint IS NULL THEN t.backlogPosition ELSE t.sprintPosition END,
             t.id
           """)
    List<Task> findByProjectIdWithScalars(@Param("projectId") Long projectId);

    @EntityGraph(attributePaths = {"labels", "assignees", "assignees.user", "assignee", "assignee.user", "reporter", "reporter.user", "subTasks", "attachments"})
    @Query("SELECT DISTINCT t FROM Task t WHERE t.id IN :ids")
    List<Task> findByIdInWithCollections(@Param("ids") List<Long> ids);

    @Query("""
           SELECT t FROM Task t
           WHERE t.project.id = :projectId
             AND t.archived = false
           """)
    List<Task> findByProjectId(@Param("projectId") Long projectId);

    @Query("""
           SELECT DISTINCT t FROM Task t
           LEFT JOIN FETCH t.project p
           LEFT JOIN FETCH p.team
           LEFT JOIN FETCH t.sprint
           LEFT JOIN FETCH t.assignee a
           LEFT JOIN FETCH a.user
           LEFT JOIN FETCH t.reporter r
           LEFT JOIN FETCH r.user
           LEFT JOIN FETCH t.milestone
           LEFT JOIN FETCH t.lastModifiedBy
           WHERE t.sprint.id = :sprintId
             AND t.archived = false
           """)
    List<Task> findBySprintIdWithScalars(@Param("sprintId") Long sprintId);

    @Query("""
           SELECT t FROM Task t
           WHERE t.sprint.id = :sprintId
             AND t.archived = false
           """)
    List<Task> findBySprintId(@Param("sprintId") Long sprintId);

    @Query("""
           SELECT t FROM Task t
           WHERE t.sprint.id = :sprintId
             AND t.status = :status
             AND t.archived = false
           """)
    List<Task> findBySprintIdAndStatus(@Param("sprintId") Long sprintId, @Param("status") String status);

    boolean existsBySprint_IdAndStatusAndArchivedFalse(Long sprintId, String status);

    @Query("SELECT t FROM Task t WHERE t.parentTask.id = :parentId AND t.archived = false")
    List<Task> findSubtasksByParentId(@Param("parentId") Long parentId);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.assignee = :assignee AND t.project.team.id = :teamId AND t.archived = false")
    long countByAssigneeAndProject_TeamId(@Param("assignee") com.planora.backend.model.TeamMember assignee, @Param("teamId") Long teamId);

    @Query("""
           SELECT a.user.userId, COUNT(t.id)
           FROM Task t
           JOIN t.assignee a
           WHERE a.user.userId IN :userIds
             AND t.project.team.id = :teamId
             AND t.archived = false
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
           "AND t.archived = false " +
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
           "WHERE t.archived = false " +
           "AND (t.lastModifiedBy.userId = :userId OR a.user.userId = :userId) " +
           "ORDER BY t.updatedAt DESC")
    List<Task> findTasksWorkedOnByUser(@Param("userId") Long userId, Pageable pageable);

    @Query("SELECT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.team pt " +
           "WHERE t.id = :taskId")
    java.util.Optional<Task> findByIdWithProjectTeam(@Param("taskId") Long taskId);

    @Query("""
           SELECT DISTINCT t FROM Task t
           LEFT JOIN FETCH t.project p
           LEFT JOIN FETCH p.team
           LEFT JOIN FETCH t.sprint
           LEFT JOIN FETCH t.assignee a
           LEFT JOIN FETCH a.user
           LEFT JOIN FETCH t.reporter r
           LEFT JOIN FETCH r.user
           LEFT JOIN FETCH t.milestone
           LEFT JOIN FETCH t.kanbanColumn
           LEFT JOIN FETCH t.labels
           WHERE t.id = :taskId
           """)
    java.util.Optional<Task> findByIdWithDetails(@Param("taskId") Long taskId);

    @Query("""
           SELECT t FROM Task t
           LEFT JOIN FETCH t.assignee primaryAssignee
           LEFT JOIN FETCH primaryAssignee.user
           LEFT JOIN FETCH t.reporter rep
           LEFT JOIN FETCH rep.user
           LEFT JOIN FETCH t.sprint
           LEFT JOIN FETCH t.milestone
           LEFT JOIN FETCH t.project proj
           LEFT JOIN FETCH proj.team
           WHERE t.id = :id
           """)
    java.util.Optional<Task> findByIdFullyFetched(@Param("id") Long id);

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
           "AND t.archived = false " +
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
           "AND t.archived = false " +
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
           "WHERE t.archived = false AND t.nextOccurrence IS NOT NULL AND t.nextOccurrence <= :today AND t.recurrenceRule IS NOT NULL")
    List<Task> findByNextOccurrenceBeforeOrEqualWithAssociations(@Param("today") LocalDate today);

    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.team pt " +
           "LEFT JOIN FETCH t.sprint s " +
           "LEFT JOIN FETCH t.assignee a " +
           "LEFT JOIN FETCH a.user au " +
           "LEFT JOIN FETCH t.reporter r " +
           "LEFT JOIN FETCH r.user ru " +
           "WHERE t.id IN :ids " +
           "AND t.archived = false")
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
           "WHERE t.id IN :ids " +
           "AND t.archived = false")
    List<Task> findByIdInWithScalars(@Param("ids") List<Long> ids);

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
           "WHERE t.id IN :ids " +
           "AND t.archived = true")
    List<Task> findArchivedByIdInWithScalars(@Param("ids") List<Long> ids);

    @Query("SELECT t.id FROM Task t " +
           "WHERE t.assignee.user.userId = :userId " +
           "AND t.archived = false " +
           "ORDER BY t.updatedAt DESC")
    List<Long> findAssignedTaskIdsByUser(@Param("userId") Long userId, Pageable pageable);

    @Query("SELECT t.id FROM Task t " +
           "LEFT JOIN t.assignee a " +
           "WHERE t.archived = false " +
           "AND (t.lastModifiedBy.userId = :userId OR a.user.userId = :userId) " +
           "GROUP BY t.id, t.updatedAt " +
           "ORDER BY t.updatedAt DESC")
    List<Long> findWorkedOnTaskIdsByUser(@Param("userId") Long userId, Pageable pageable);

    @Query("SELECT t.sprint.id, SUM(t.storyPoint), " +
           "SUM(CASE WHEN UPPER(t.status) = 'DONE' THEN t.storyPoint ELSE 0 END) " +
           "FROM Task t WHERE t.sprint.id IN :sprintIds AND t.archived = false GROUP BY t.sprint.id")
    List<Object[]> aggregateVelocityBySprintIds(@Param("sprintIds") List<Long> sprintIds);

    @Query("""
           SELECT t.id, d.id, d.title
           FROM Task t
           LEFT JOIN t.dependencies d
           WHERE t.id IN :taskIds
           """)
    List<Object[]> findDependencyRowsByTaskIds(@Param("taskIds") List<Long> taskIds);

    @Query("""
           SELECT t.id, d.id
           FROM Task t
           JOIN t.dependencies d
           """)
    List<Object[]> findAllDependencyRows();

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.dependencies WHERE t.id = :id")
    java.util.Optional<Task> findByIdWithDependencies(@Param("id") Long id);

    @Query("SELECT COALESCE(MAX(t.projectTaskNumber), 0) FROM Task t WHERE t.project.id = :projectId")
    Long findMaxProjectTaskNumberByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT COALESCE(MAX(t.backlogPosition), -1) FROM Task t WHERE t.project.id = :projectId AND t.sprint IS NULL AND t.archived = false")
    Integer findMaxBacklogPositionByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT COALESCE(MAX(t.sprintPosition), -1) FROM Task t WHERE t.sprint.id = :sprintId AND t.archived = false")
    Integer findMaxSprintPositionBySprintId(@Param("sprintId") Long sprintId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE Task t SET t.backlogPosition = t.backlogPosition - 1 " +
           "WHERE t.project.id = :projectId " +
           "AND t.sprint IS NULL " +
           "AND t.archived = false " +
           "AND t.backlogPosition > :deletedPosition " +
           "AND t.backlogPosition IS NOT NULL")
    void compactBacklogPositions(
            @Param("projectId") Long projectId,
            @Param("deletedPosition") Integer deletedPosition
    );

    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE Task t SET t.sprintPosition = t.sprintPosition - 1 " +
           "WHERE t.sprint.id = :sprintId " +
           "AND t.archived = false " +
           "AND t.sprintPosition > :deletedPosition " +
           "AND t.sprintPosition IS NOT NULL")
    void compactSprintPositions(
            @Param("sprintId") Long sprintId,
            @Param("deletedPosition") Integer deletedPosition
    );

    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.project p " +
           "LEFT JOIN FETCH p.owner po " +
           "LEFT JOIN FETCH t.assignee a " +
           "LEFT JOIN FETCH a.user au " +
           "LEFT JOIN FETCH t.assignees tas " +
           "LEFT JOIN FETCH tas.user tau " +
           "WHERE t.dueDate IS NOT NULL " +
           "AND t.archived = false " +
           "AND UPPER(COALESCE(t.status, '')) <> 'DONE' " +
           "AND t.dueDate <= :maxDueDate")
    List<Task> findOpenTasksDueOnOrBeforeWithReminderRelations(@Param("maxDueDate") LocalDate maxDueDate);

    @Query("SELECT t.id FROM Task t " +
           "WHERE t.project.id = :projectId AND t.archived = true " +
           "ORDER BY t.archivedAt DESC")
    List<Long> findArchivedTaskIdsByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT t FROM Task t " +
           "WHERE t.project.id = :projectId AND t.archived = true " +
           "ORDER BY t.archivedAt DESC")
    List<Task> findArchivedByProjectId(@Param("projectId") Long projectId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE Task t SET t.assignee = null WHERE t.assignee.id = :memberId")
    void nullifyAssigneeForMember(@Param("memberId") Long memberId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE Task t SET t.reporter = null WHERE t.reporter.id = :memberId")
    void nullifyReporterForMember(@Param("memberId") Long memberId);

    @org.springframework.data.jpa.repository.Modifying
    @Query(value = "DELETE FROM task_assignees WHERE member_id = :memberId", nativeQuery = true)
    void removeFromTaskAssignees(@Param("memberId") Long memberId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE Task t SET t.githubBranch = :branch WHERE t.id = :taskId")
    void updateGithubBranch(@Param("taskId") Long taskId, @Param("branch") String branch);
}
