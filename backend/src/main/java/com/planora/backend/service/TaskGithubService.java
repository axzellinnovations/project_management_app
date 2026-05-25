package com.planora.backend.service;

import com.planora.backend.dto.GitHubTaskData;
import com.planora.backend.dto.TaskGithubSummaryDTO;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.GithubCommit;
import com.planora.backend.model.GithubPullRequest;
import com.planora.backend.model.Task;
import com.planora.backend.repository.GithubCommitRepository;
import com.planora.backend.repository.GithubPullRequestRepository;
import com.planora.backend.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Aggregates all GitHub-related data for a Planora task.
 *
 * Responsibilities:
 *  1. Read aggregated GitHub data from the DB (fast, no external calls).
 *  2. Sync fresh data from the GitHub API via GitHubIntegrationService and persist it.
 *  3. Expose a batch summary method to avoid N+1 queries when listing tasks.
 *
 * Architecture notes:
 *  - This service owns the github_pull_requests and github_commits tables.
 *  - GitHubIntegrationService handles the raw HTTP calls; this service handles
 *    persistence and aggregation. The two have no circular dependency.
 *  - TaskService injects this service (not GitHubIntegrationService directly),
 *    keeping GitHub concerns fully encapsulated here.
 */
@Service
@Transactional
public class TaskGithubService {

    @Autowired
    private GithubPullRequestRepository prRepository;

    @Autowired
    private GithubCommitRepository commitRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private GitHubIntegrationService gitHubIntegrationService;

    // ── 1. READ — DB-backed aggregation ──────────────────────────────────────────

    /**
     * Returns the stored GitHub summary for a task without making any
     * external API call. Fast and safe to call on every task-detail request.
     *
     * @throws ResourceNotFoundException when the task does not exist
     */
    @Transactional(readOnly = true)
    public TaskGithubSummaryDTO getTaskGithubSummary(Long taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        List<GithubPullRequest> prs     = prRepository.findByTaskId(taskId);
        List<GithubCommit>      commits = commitRepository.findByTaskId(taskId);

        return buildSummary(task, prs, commits);
    }

    /**
     * Batch variant — loads PRs and commits for all supplied task IDs in
     * exactly two SQL queries, then assembles the summaries in memory.
     * Use this when rendering a list view to avoid N+1 database calls.
     *
     * @param taskIds list of task IDs to summarise
     * @return map of taskId → summary; tasks with no GitHub data get an empty summary
     */
    @Transactional(readOnly = true)
    public Map<Long, TaskGithubSummaryDTO> getTaskGithubSummaries(List<Long> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return Collections.emptyMap();
        }

        // Two bulk queries instead of 2 × N individual queries.
        List<GithubPullRequest> allPRs     = prRepository.findAllByTaskIds(taskIds);
        List<GithubCommit>      allCommits = commitRepository.findAllByTaskIds(taskIds);
        List<Task>              tasks      = taskRepository.findAllById(taskIds);

        // Group by task ID in memory — O(n) traversal.
        Map<Long, List<GithubPullRequest>> prsByTask = allPRs.stream()
                .collect(Collectors.groupingBy(pr -> pr.getTask().getId()));
        Map<Long, List<GithubCommit>> commitsByTask = allCommits.stream()
                .collect(Collectors.groupingBy(c -> c.getTask().getId()));

        return tasks.stream().collect(Collectors.toMap(
                Task::getId,
                task -> buildSummary(
                        task,
                        prsByTask.getOrDefault(task.getId(), Collections.emptyList()),
                        commitsByTask.getOrDefault(task.getId(), Collections.emptyList())
                )
        ));
    }

    // ── 2. BRANCH — direct access to the persisted branch name ───────────────────

    /**
     * Returns the branch name stored on the task entity.
     * Null when the task has no linked GitHub branch.
     */
    @Transactional(readOnly = true)
    public String getBranchForTask(Long taskId) {
        return taskRepository.findById(taskId)
                .map(Task::getGithubBranch)
                .orElse(null);
    }

    // ── 3. CI STATUS — derived from the most-recent stored commit ────────────────

    /**
     * Returns the CI status of the most-recently synced commit for the task,
     * or null when no commits have been synced yet.
     */
    @Transactional(readOnly = true)
    public String getLatestCiStatus(Long taskId) {
        return commitRepository.findLatestByTaskId(taskId)
                .map(GithubCommit::getCiStatus)
                .orElse(null);
    }

    // ── 4. SYNC — fetch from GitHub API and persist ───────────────────────────────

    /**
     * Fetches the latest PRs, commits, and CI status from the GitHub API for
     * the task's linked branch, then writes the results to the database.
     * Safe to call even when the task has no linked branch — exits early.
     *
     * @param taskId       Planora task to sync
     * @param repoFullName "owner/repo" of the connected GitHub repository
     * @param githubToken  per-user OAuth or PAT token
     */
    public void syncFromGitHub(Long taskId, String repoFullName, String githubToken) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        if (isBlank(task.getGithubBranch()) || isBlank(repoFullName) || isBlank(githubToken)) {
            return;
        }

        GitHubTaskData data = gitHubIntegrationService.fetchTaskGitHubData(
                repoFullName, task.getGithubBranch(), githubToken);

        if (data == null) return;

        persistPullRequests(task, data.getLinkedPrs());
        persistCommits(task, data.getRecentCommits(), data.getCiStatus());
    }

    /**
     * Convenience method that syncs and then returns the freshly stored summary
     * in a single call. Used by TaskService.getTaskById(taskId, repo, token).
     */
    public TaskGithubSummaryDTO syncAndGetSummary(Long taskId, String repoFullName, String githubToken) {
        syncFromGitHub(taskId, repoFullName, githubToken);

        // Re-read from DB so the returned DTO reflects exactly what was persisted.
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        List<GithubPullRequest> prs     = prRepository.findByTaskId(taskId);
        List<GithubCommit>      commits = commitRepository.findByTaskId(taskId);
        return buildSummary(task, prs, commits);
    }

    // ── Private helpers ───────────────────────────────────────────────────────────

    private void persistPullRequests(Task task, List<GitHubTaskData.LinkedPr> incoming) {
        if (incoming == null || incoming.isEmpty()) return;

        // Delete-then-insert keeps the table in sync without complex diff logic.
        prRepository.deleteAllByTaskId(task.getId());
        prRepository.flush();

        LocalDateTime now = LocalDateTime.now();
        List<GithubPullRequest> entities = incoming.stream()
                .map(pr -> new GithubPullRequest(
                        null, task, pr.getNumber(), pr.getTitle(),
                        pr.getState(), pr.getHtmlUrl(), pr.getAuthor(),
                        pr.getCreatedAt(), pr.getMergedAt(),
                        pr.getHeadBranch(), pr.getBaseBranch(), now))
                .collect(Collectors.toList());
        prRepository.saveAll(entities);
    }

    private void persistCommits(Task task,
                                 List<GitHubTaskData.RecentCommit> incoming,
                                 String overallCiStatus) {
        if (incoming == null || incoming.isEmpty()) return;

        commitRepository.deleteAllByTaskId(task.getId());
        commitRepository.flush();

        LocalDateTime now = LocalDateTime.now();
        List<GithubCommit> entities = new ArrayList<>();
        for (int i = 0; i < incoming.size(); i++) {
            GitHubTaskData.RecentCommit c = incoming.get(i);
            // CI status is applied to the most-recent commit only; older commits are null.
            String commitCiStatus = (i == 0) ? overallCiStatus : null;
            entities.add(new GithubCommit(
                    null, task, c.getSha(), c.getMessage(),
                    c.getAuthor(), c.getDate(), c.getHtmlUrl(),
                    commitCiStatus, now));
        }
        commitRepository.saveAll(entities);
    }

    private TaskGithubSummaryDTO buildSummary(Task task,
                                               List<GithubPullRequest> prs,
                                               List<GithubCommit> commits) {
        String ciStatus = commits.stream()
                .filter(c -> c.getCiStatus() != null)
                .findFirst()
                .map(GithubCommit::getCiStatus)
                .orElse(null);

        return TaskGithubSummaryDTO.builder()
                .taskId(task.getId())
                .githubBranch(task.getGithubBranch())
                .prCount(prs.size())
                .ciStatus(ciStatus)
                .pullRequests(prs.stream().map(this::toPrItem).collect(Collectors.toList()))
                .commits(commits.stream().map(this::toCommitItem).collect(Collectors.toList()))
                .build();
    }

    private TaskGithubSummaryDTO.PullRequestItem toPrItem(GithubPullRequest pr) {
        return TaskGithubSummaryDTO.PullRequestItem.builder()
                .id(pr.getId())
                .prNumber(pr.getPrNumber())
                .title(pr.getTitle())
                .state(pr.getState())
                .htmlUrl(pr.getHtmlUrl())
                .author(pr.getAuthor())
                .createdAt(pr.getCreatedAt())
                .mergedAt(pr.getMergedAt())
                .headBranch(pr.getHeadBranch())
                .baseBranch(pr.getBaseBranch())
                .build();
    }

    private TaskGithubSummaryDTO.CommitItem toCommitItem(GithubCommit c) {
        String sha = c.getSha();
        String shortSha = (sha != null && sha.length() >= 7) ? sha.substring(0, 7) : sha;
        return TaskGithubSummaryDTO.CommitItem.builder()
                .id(c.getId())
                .sha(shortSha)
                .message(c.getMessage())
                .author(c.getAuthor())
                .committedAt(c.getCommittedAt())
                .htmlUrl(c.getHtmlUrl())
                .ciStatus(c.getCiStatus())
                .build();
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
