package com.planora.backend.repository;

import com.planora.backend.model.GithubCommit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GithubCommitRepository extends JpaRepository<GithubCommit, Long> {

    /** All commits for a single task, most-recently synced first. */
    @Query("SELECT c FROM GithubCommit c WHERE c.task.id = :taskId ORDER BY c.syncedAt DESC, c.committedAt DESC")
    List<GithubCommit> findByTaskId(@Param("taskId") Long taskId);

    /**
     * Batch fetch for multiple tasks — one SQL query instead of N.
     * Used by TaskGithubService.getTaskGithubSummaries to avoid N+1.
     */
    @Query("SELECT c FROM GithubCommit c WHERE c.task.id IN :taskIds ORDER BY c.syncedAt DESC, c.committedAt DESC")
    List<GithubCommit> findAllByTaskIds(@Param("taskIds") List<Long> taskIds);

    /**
     * Returns the single most-recently synced commit for a task.
     * Used to derive the latest CI status without loading the whole list.
     */
    @Query("SELECT c FROM GithubCommit c WHERE c.task.id = :taskId ORDER BY c.syncedAt DESC, c.committedAt DESC")
    Optional<GithubCommit> findLatestByTaskId(@Param("taskId") Long taskId);

    /** Wipes all commit rows for a task before a fresh sync write. */
    @Modifying
    @Query("DELETE FROM GithubCommit c WHERE c.task.id = :taskId")
    void deleteAllByTaskId(@Param("taskId") Long taskId);
}
