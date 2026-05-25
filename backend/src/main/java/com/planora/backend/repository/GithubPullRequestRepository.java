package com.planora.backend.repository;

import com.planora.backend.model.GithubPullRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GithubPullRequestRepository extends JpaRepository<GithubPullRequest, Long> {

    /** All PRs for a single task, ordered most-recent first. */
    @Query("SELECT p FROM GithubPullRequest p WHERE p.task.id = :taskId ORDER BY p.createdAt DESC")
    List<GithubPullRequest> findByTaskId(@Param("taskId") Long taskId);

    /**
     * Batch fetch for multiple tasks — issues one SQL query instead of N.
     * Used by TaskGithubService.getTaskGithubSummaries to avoid N+1.
     */
    @Query("SELECT p FROM GithubPullRequest p WHERE p.task.id IN :taskIds ORDER BY p.createdAt DESC")
    List<GithubPullRequest> findAllByTaskIds(@Param("taskIds") List<Long> taskIds);

    /** Wipes all PR rows for a task before a fresh sync write. */
    @Modifying
    @Query("DELETE FROM GithubPullRequest p WHERE p.task.id = :taskId")
    void deleteAllByTaskId(@Param("taskId") Long taskId);
}
