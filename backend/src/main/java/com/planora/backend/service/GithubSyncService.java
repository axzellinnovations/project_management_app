package com.planora.backend.service;

import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.Task;
import com.planora.backend.repository.GithubIntegrationRepository;
import com.planora.backend.repository.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Scheduled service that periodically syncs GitHub data for all active integrations.
 *
 * Runs every 30 minutes. For each active integration:
 *  1. Loads tasks that have a github_branch set for the project.
 *  2. Syncs PRs and commits for each task.
 *  3. Syncs repository issues for the project.
 *
 * Requires @EnableScheduling — provided by SchedulingConfig.
 */
@Service
public class GithubSyncService {

    private static final Logger log = LoggerFactory.getLogger(GithubSyncService.class);

    @Autowired private GithubIntegrationRepository integrationRepository;
    @Autowired private TaskRepository              taskRepository;
    @Autowired private GithubPullRequestService    prService;
    @Autowired private GithubCommitService         commitService;
    @Autowired private GithubIssueService          issueService;

    @Scheduled(fixedDelayString = "${github.sync.interval-ms:1800000}")
    public void syncAllActiveIntegrations() {
        List<GithubIntegration> active = integrationRepository.findAllActive();
        if (active.isEmpty()) return;

        log.info("Starting GitHub sync for {} active integration(s)", active.size());
        for (GithubIntegration integration : active) {
            try {
                syncIntegration(integration);
            } catch (Exception e) {
                log.error("GitHub sync failed for project {}: {}",
                        integration.getProjectId(), e.getMessage());
            }
        }
        log.info("GitHub sync complete");
    }

    @Transactional
    public void syncIntegration(GithubIntegration integration) {
        Long   projectId     = integration.getProjectId();
        String repoFullName  = integration.getRepoFullName();
        String token         = integration.getGithubToken();

        if (token == null || token.isBlank()) {
            log.debug("Skipping project {} — no token stored", projectId);
            return;
        }

        List<Task> tasksWithBranch = taskRepository.findByProjectIdAndGithubBranchNotNull(projectId);
        log.debug("Syncing {} task(s) for project {}", tasksWithBranch.size(), projectId);

        for (Task task : tasksWithBranch) {
            String branch = task.getGithubBranch();
            if (branch == null || branch.isBlank()) continue;
            try {
                prService.syncForTask(task, repoFullName, branch, token);
                commitService.syncForTask(task, repoFullName, branch, token);
            } catch (Exception e) {
                log.warn("Sync failed for task {}: {}", task.getId(), e.getMessage());
            }
        }

        issueService.syncForProject(projectId, repoFullName, token);
    }

    /**
     * Manual sync trigger for a single project — called from the controller.
     */
    @Transactional
    public void syncProject(Long projectId) {
        integrationRepository.findActiveByProjectId(projectId).ifPresent(this::syncIntegration);
    }
}
