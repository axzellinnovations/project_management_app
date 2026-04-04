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

    // "Worked On"
    @Query("SELECT t FROM Task t WHERE (t.assignee.user.userId = :userId OR t.reporter.user.userId = :userId) AND t.lastModifiedBy.userId = :userId ORDER BY t.updatedAt DESC")
    List<Task> findTasksWorkedOnByUser(@Param("userId") Long userId, Pageable pageable);
}
