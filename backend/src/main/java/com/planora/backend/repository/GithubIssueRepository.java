package com.planora.backend.repository;

import com.planora.backend.model.GithubIssue;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GithubIssueRepository extends JpaRepository<GithubIssue, Long> {

    Page<GithubIssue> findByIntegrationIdIn(List<Long> integrationIds, Pageable pageable);

    Page<GithubIssue> findByIntegrationIdInAndState(List<Long> integrationIds, String state, Pageable pageable);

    Optional<GithubIssue> findByIntegrationIdAndGithubIssueNumber(Long integrationId, Integer githubIssueNumber);

    List<GithubIssue> findByLinkedTaskId(Long taskId);

    long countByIntegrationId(Long integrationId);

    long countByIntegrationIdIn(List<Long> integrationIds);

    long countByIntegrationIdInAndState(List<Long> integrationIds, String state);
}
