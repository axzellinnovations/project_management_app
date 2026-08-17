package com.planora.backend.repository;

import java.util.List;
import java.util.Optional;

import com.planora.backend.model.GithubCommit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GithubCommitRepository extends JpaRepository<GithubCommit, Long> {
    Page<GithubCommit> findByIntegrationIdIn(List<Long> integrationIds, Pageable pageable);

    Optional<GithubCommit> findByIntegrationIdAndSha(Long integrationId, String sha);

    List<GithubCommit> findByLinkedTaskId(Long taskId);

    long countByIntegrationId(Long integrationId);

    long countByIntegrationIdIn(List<Long> integrationIds);

    @Query("SELECT c FROM GithubCommit c WHERE (c.task.id = :taskId OR c.linkedTaskId = :taskId) "
            + "ORDER BY COALESCE(c.authoredAt, c.syncedAt) DESC")
    List<GithubCommit> findByTaskId(@Param("taskId") Long taskId);

    @Query("SELECT c FROM GithubCommit c WHERE (c.task.id IN :taskIds OR c.linkedTaskId IN :taskIds) "
            + "ORDER BY COALESCE(c.authoredAt, c.syncedAt) DESC")
    List<GithubCommit> findAllByTaskIds(@Param("taskIds") List<Long> taskIds);

    @Query("SELECT c FROM GithubCommit c WHERE (c.task.id = :taskId OR c.linkedTaskId = :taskId) "
            + "ORDER BY COALESCE(c.authoredAt, c.syncedAt) DESC")
    List<GithubCommit> findRecentByTaskId(@Param("taskId") Long taskId, Pageable pageable);

    @Modifying
    @Query("DELETE FROM GithubCommit c WHERE (c.task.id = :taskId OR c.linkedTaskId = :taskId)")
    void deleteAllByTaskId(@Param("taskId") Long taskId);

    @Query("SELECT c FROM GithubCommit c WHERE c.sha = :sha")
    List<GithubCommit> findBySha(@Param("sha") String sha);

    @Modifying
    @Query("UPDATE GithubCommit c SET c.ciStatus = :status WHERE c.sha = :sha")
    void updateCiStatusBySha(@Param("sha") String sha, @Param("status") String status);
}
