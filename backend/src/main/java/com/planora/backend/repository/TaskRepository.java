package com.planora.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.planora.backend.model.Task;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByProjectId(Long projectId);
    List<Task> findBySprintId(Long sprintId);
    List<Task> findBySprintIdAndStatus(Long sprintId, com.planora.backend.model.Status status);

    long countByAssigneeAndProject_TeamId(com.planora.backend.model.TeamMember assignee, Long teamId);
}
