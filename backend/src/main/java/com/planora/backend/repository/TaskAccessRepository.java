package com.planora.backend.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.planora.backend.model.TaskAccess;
import com.planora.backend.model.Task;
import com.planora.backend.model.User;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskAccessRepository extends JpaRepository<TaskAccess, Long> {
    Optional<TaskAccess> findByTaskAndUser(Task task, User user);
    
    // For "Recent Tasks" endpoints
    @EntityGraph(attributePaths = {
            "task",
            "task.project",
            "task.project.team",
            "task.assignee",
            "task.assignee.user",
            "task.reporter",
            "task.reporter.user",
            "task.sprint",
            "task.milestone"
    })
    List<TaskAccess> findByUserUserIdOrderByLastAccessedAtDesc(Long userId, Pageable pageable);

    @Query("SELECT ta.task.id FROM TaskAccess ta WHERE ta.user.userId = :userId ORDER BY ta.lastAccessedAt DESC")
    List<Long> findRecentTaskIdsByUser(@Param("userId") Long userId, Pageable pageable);
}
