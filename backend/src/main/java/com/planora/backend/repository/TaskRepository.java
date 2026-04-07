package com.planora.backend.repository;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.planora.backend.model.Task;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByProjectId(Long projectId);
    List<Task> findBySprintId(Long sprintId);
    List<Task> findBySprintIdAndStatus(Long sprintId, com.planora.backend.model.Status status);

    long countByAssigneeAndProject_TeamId(com.planora.backend.model.TeamMember assignee, Long teamId);

    // "Assigned to me"
    List<Task> findByAssigneeUserUserIdOrderByUpdatedAtDesc(Long userId, Pageable pageable);

    // "Worked On" — tasks this user was involved in (assigned or reported) and last modified by them
    @Query("SELECT DISTINCT t FROM Task t WHERE t.lastModifiedBy.userId = :userId OR t.assignee.user.userId = :userId ORDER BY t.updatedAt DESC")
    List<Task> findTasksWorkedOnByUser(@Param("userId") Long userId, Pageable pageable);

    // Server-side filtered tasks for a project
    @Query("SELECT t FROM Task t WHERE t.project.id = :projectId " +
           "AND (:status IS NULL OR t.status = :status) " +
           "AND (:assigneeId IS NULL OR t.assignee.user.userId = :assigneeId) " +
           "AND (:priority IS NULL OR CAST(t.priority AS string) = :priority) " +
           "AND (:sprintId IS NULL OR t.sprint.id = :sprintId) " +
           "ORDER BY t.createdAt DESC")
    List<Task> findByProjectIdFiltered(
            @Param("projectId") Long projectId,
            @Param("status") String status,
            @Param("assigneeId") Long assigneeId,
            @Param("priority") String priority,
            @Param("sprintId") Long sprintId);
}
