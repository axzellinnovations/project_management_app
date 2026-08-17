package com.planora.backend.repository;

import java.util.List;
import java.util.Optional;

import com.planora.backend.model.GithubPullRequest;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GithubPullRequestRepository extends JpaRepository<GithubPullRequest, Long> {
    Page<GithubPullRequest> findByIntegrationIdIn(List<Long> integrationIds, Pageable pageable);

    Page<GithubPullRequest> findByIntegrationIdInAndState(List<Long> integrationIds, String state, Pageable pageable);

    Optional<GithubPullRequest> findByIntegrationIdAndGithubPrNumber(Long integrationId, Integer githubPrNumber);

    List<GithubPullRequest> findByLinkedTaskId(Long taskId);

    long countByIntegrationId(Long integrationId);

    long countByIntegrationIdIn(List<Long> integrationIds);

    long countByIntegrationIdInAndState(List<Long> integrationIds, String state);

    @Query("SELECT p FROM GithubPullRequest p WHERE (p.task.id = :taskId OR p.linkedTaskId = :taskId) "
            + "ORDER BY COALESCE(p.githubUpdatedAt, p.githubCreatedAt, p.syncedAt) DESC")
    List<GithubPullRequest> findByTaskId(@Param("taskId") Long taskId);

    @Query("SELECT p FROM GithubPullRequest p WHERE (p.task.id IN :taskIds OR p.linkedTaskId IN :taskIds) "
            + "ORDER BY COALESCE(p.githubUpdatedAt, p.githubCreatedAt, p.syncedAt) DESC")
    List<GithubPullRequest> findAllByTaskIds(@Param("taskIds") List<Long> taskIds);

    @Modifying
    @Query("DELETE FROM GithubPullRequest p WHERE (p.task.id = :taskId OR p.linkedTaskId = :taskId)")
    void deleteAllByTaskId(@Param("taskId") Long taskId);
}
