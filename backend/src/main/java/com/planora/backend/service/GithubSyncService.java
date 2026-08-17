package com.planora.backend.service;

import com.planora.backend.dto.GithubStatsDTO;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.repository.GithubCommitRepository;
import com.planora.backend.repository.GithubIntegrationRepository;
import com.planora.backend.repository.GithubIssueRepository;
import com.planora.backend.repository.GithubPullRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import com.planora.backend.service.GithubApiClient.GithubApiException;

import java.util.List;
import java.time.Duration;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GithubSyncService {

    private final GithubIntegrationRepository integrationRepository;
    private final GithubPullRequestService pullRequestService;
    private final GithubCommitService commitService;
    private final GithubIssueService issueService;
    private final GithubPullRequestRepository pullRequestRepository;
    private final GithubCommitRepository commitRepository;
    private final GithubIssueRepository issueRepository;
    private final GithubTokenService githubTokenService;
    private final ScheduledJobLockService scheduledJobLockService;

    @Value("${github.sync.enabled:true}")
    private boolean syncEnabled;

    @Scheduled(fixedDelayString = "${github.sync.interval-ms:300000}")
    public void scheduledSync() {
        if (!syncEnabled) return;
        if (!scheduledJobLockService.tryAcquire("github-scheduled-sync", Duration.ofMinutes(10))) {
            log.debug("Scheduled GitHub sync is already running on another instance.");
            return;
        }

        try {
            List<GithubIntegration> integrations = integrationRepository.findAllByActiveTrue();
            if (integrations.isEmpty()) return;

            log.info("Starting scheduled GitHub sync for {} integrations", integrations.size());
            integrations.forEach(this::syncIntegration);
            log.info("Scheduled GitHub sync complete");
        } finally {
            scheduledJobLockService.release("github-scheduled-sync");
        }
    }

    public void syncProject(Long projectId) {
        List<GithubIntegration> integrations = integrationRepository.findByProjectIdAndActiveTrue(projectId);
        if (integrations.isEmpty()) {
            log.info("No active GitHub integrations for project {}", projectId);
            return;
        }
        log.info("Manual sync triggered for project {} ({} repos)", projectId, integrations.size());
        integrations.forEach(this::syncIntegration);
    }

    public GithubStatsDTO getStats(Long projectId) {
        List<Long> ids = integrationRepository.findByProjectIdAndActiveTrue(projectId)
            .stream().map(GithubIntegration::getId).collect(Collectors.toList());

        if (ids.isEmpty()) {
            return GithubStatsDTO.builder()
                .linkedRepositories(0)
                .build();
        }

        long totalPrs  = pullRequestRepository.countByIntegrationIdIn(ids);
        long openPrs   = pullRequestRepository.countByIntegrationIdInAndState(ids, "open");
        long mergedPrs = pullRequestRepository.countByIntegrationIdInAndState(ids, "merged");
        long closedPrs = pullRequestRepository.countByIntegrationIdInAndState(ids, "closed");
        long totalCommits = commitRepository.countByIntegrationIdIn(ids);
        long totalIssues = issueRepository.countByIntegrationIdIn(ids);
        long openIssues  = issueRepository.countByIntegrationIdInAndState(ids, "open");
        long closedIssues = issueRepository.countByIntegrationIdInAndState(ids, "closed");

        return GithubStatsDTO.builder()
            .linkedRepositories(ids.size())
            .totalPullRequests(totalPrs)
            .openPullRequests(openPrs)
            .mergedPullRequests(mergedPrs)
            .closedPullRequests(closedPrs)
            .totalCommits(totalCommits)
            .totalIssues(totalIssues)
            .openIssues(openIssues)
            .closedIssues(closedIssues)
            .build();
    }

    private void syncIntegration(GithubIntegration integration) {
        if (!githubTokenService.hasValidToken(integration)) {
            log.warn("Skipping sync for integration {} — no token", integration.getId());
            return;
        }
        try {
            pullRequestService.syncPullRequests(integration);
        } catch (Exception e) {
            if (handleSyncError(integration, e)) return;
            log.error("PR sync failed for integration {}: {}", integration.getId(), e.getMessage());
        }
        try {
            commitService.syncCommits(integration);
        } catch (Exception e) {
            if (handleSyncError(integration, e)) return;
            log.error("Commit sync failed for integration {}: {}", integration.getId(), e.getMessage());
        }
        try {
            issueService.syncIssues(integration);
        } catch (Exception e) {
            if (handleSyncError(integration, e)) return;
            log.error("Issue sync failed for integration {}: {}", integration.getId(), e.getMessage());
        }
    }

    private boolean handleSyncError(GithubIntegration integration, Exception e) {
        Throwable cause = e;
        while (cause != null) {
            if (cause instanceof GithubApiException apiException) {
                if (apiException.getStatusCode() == 401) {
                    log.warn("Unauthorized (401) response from GitHub API for integration {} ({}). Skipping sync cycle.",
                            integration.getId(), integration.getRepositoryFullName());
                    return true;
                }
            }
            cause = cause.getCause();
        }
        return false;
    }
}
