package com.planora.backend.repository;

import com.planora.backend.model.GithubCommit;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GithubCommitRepository extends JpaRepository<GithubCommit, Long> {

    /**
     * All commits for a single task, sorted by commit timestamp descending.
     * ISO-8601 strings from GitHub are in UTC (Z suffix), so lexicographic order
     * equals chronological order — string DESC == newest-first.
     * Falls back to syncedAt when committedAt is null (defensive only; GitHub always sets it).
     */
    @Query("SELECT c FROM GithubCommit c WHERE c.task.id = :taskId " +
           "ORDER BY c.committedAt DESC, c.syncedAt DESC")
    List<GithubCommit> findByTaskId(@Param("taskId") Long taskId);

    /**
     * Batch fetch for multiple tasks — one SQL query instead of N.
     * Used by TaskGithubService.getTaskGithubSummaries to avoid N+1.
     */
    @Query("SELECT c FROM GithubCommit c WHERE c.task.id IN :taskIds " +
           "ORDER BY c.committedAt DESC, c.syncedAt DESC")
    List<GithubCommit> findAllByTaskIds(@Param("taskIds") List<Long> taskIds);

    /**
     * Paginated commit retrieval sorted by committed_at descending.
     *
     * Used for two purposes:
     *   1. {@code PageRequest.of(0, 1)}  — fetch the single most-recent commit
     *      (replaces the old Optional-returning findLatestByTaskId which would throw
     *       IncorrectResultSizeDataAccessException when multiple rows exist).
     *   2. {@code PageRequest.of(0, limit)} — return the latest N commits for the
     *      dedicated GET /api/tasks/{taskId}/commits endpoint.
     */
    @Query("SELECT c FROM GithubCommit c WHERE c.task.id = :taskId " +
           "ORDER BY c.committedAt DESC, c.syncedAt DESC")
    List<GithubCommit> findRecentByTaskId(@Param("taskId") Long taskId, Pageable pageable);

    /** Wipes all commit rows for a task before a fresh sync write. */
    @Modifying
    @Query("DELETE FROM GithubCommit c WHERE c.task.id = :taskId")
    void deleteAllByTaskId(@Param("taskId") Long taskId);

    /**
     * Finds all commit rows matching a full 40-char SHA.
     * Used by the webhook handler to locate the DB row(s) for a given check-run event.
     */
    @Query("SELECT c FROM GithubCommit c WHERE c.sha = :sha")
    List<GithubCommit> findBySha(@Param("sha") String sha);

    /**
     * Updates the ci_status for every commit row with the given SHA.
     * Used by the webhook handler for real-time CI status updates.
     */
    @Modifying
    @Query("UPDATE GithubCommit c SET c.ciStatus = :status WHERE c.sha = :sha")
    void updateCiStatusBySha(@Param("sha") String sha, @Param("status") String status);
}
