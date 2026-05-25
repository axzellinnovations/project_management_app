package com.planora.backend.service;

import com.planora.backend.dto.GitHubTaskData;
import com.planora.backend.dto.LinkedPrResponseDTO;
import com.planora.backend.dto.TaskGithubSummaryDTO;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.CiStatus;
import com.planora.backend.model.GithubCommit;
import com.planora.backend.model.GithubPullRequest;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskActivityType;
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

    @Autowired
    private TaskActivityService taskActivityService;

    @Autowired
    private CiStatusResolver ciStatusResolver;

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

    // ── 2. BRANCH — management of the task's linked GitHub branch ───────────────

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

    /**
     * Public alias for getBranchForTask — used by external callers that want
     * the simple name without the "ForTask" suffix.
     */
    @Transactional(readOnly = true)
    public String getBranch(Long taskId) {
        return getBranchForTask(taskId);
    }

    /**
     * Manually sets (or replaces) the GitHub branch linked to a task.
     * Validates the branch name format, persists it, logs a
     * GITHUB_BRANCH_UPDATED activity, and returns the refreshed summary.
     *
     * @param taskId    Planora task to update
     * @param branch    new branch name — must be non-blank, ≤255 chars, valid git chars
     * @param actorName display name of the user making the change (for the activity log)
     */
    @Transactional
    public TaskGithubSummaryDTO updateBranch(Long taskId, String branch, String actorName) {
        validateBranch(branch);
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        task.setGithubBranch(branch);
        taskRepository.save(task);
        taskActivityService.logActivity(
                taskId,
                TaskActivityType.GITHUB_BRANCH_UPDATED,
                actorName,
                "GitHub branch set to: " + branch);
        List<GithubPullRequest> prs     = prRepository.findByTaskId(taskId);
        List<GithubCommit>      commits = commitRepository.findByTaskId(taskId);
        return buildSummary(task, prs, commits);
    }

    /**
     * Silently sets the task's branch to {@code branch} when it has not been
     * set yet (auto-assign from a linked PR's head branch).
     * Does nothing if the task already has a branch, keeping manual assignments intact.
     * Not exposed as an API endpoint — called internally during PR sync.
     */
    @Transactional
    public void setBranch(Long taskId, String branch) {
        if (isBlank(branch)) return;
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
        if (!isBlank(task.getGithubBranch())) return;   // already set — honour the existing value
        try {
            validateBranch(branch);
        } catch (IllegalArgumentException e) {
            return;  // invalid branch name from GitHub — skip silently
        }
        task.setGithubBranch(branch);
        taskRepository.save(task);
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

        // Commits first so their CI status can be cross-referenced when persisting PRs.
        persistCommits(task, data.getRecentCommits(), data.getCiStatus());
        String latestCommitSha = (data.getRecentCommits() != null && !data.getRecentCommits().isEmpty())
                ? data.getRecentCommits().get(0).getSha()
                : null;
        persistPullRequests(task, data.getLinkedPrs(), latestCommitSha, data.getCiStatus());
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

    // ── 5. WEBHOOK — real-time CI status updates from GitHub events ───────────────

    /**
     * Applies a resolved CI status to all commit rows that match the given SHA.
     * Called by {@link com.planora.backend.controller.GitHubWebhookController} when a
     * {@code check_run} event arrives from GitHub.
     *
     * Uses a bulk JPQL UPDATE so no entities need to be loaded into memory.
     *
     * @param fullSha        full 40-char commit SHA from the webhook payload
     * @param resolvedStatus the normalized status to persist
     */
    @Transactional
    public void updateCiStatusBySha(String fullSha, CiStatus resolvedStatus) {
        if (isBlank(fullSha) || resolvedStatus == null) return;
        commitRepository.updateCiStatusBySha(fullSha, resolvedStatus.name());
    }

    /**
     * Returns true when at least one commit row in the DB matches the given SHA.
     * Used by the webhook controller to skip events for commits not linked to any task.
     */
    @Transactional(readOnly = true)
    public boolean hasCommitWithSha(String sha) {
        return !commitRepository.findBySha(sha).isEmpty();
    }

    // ── Private helpers ───────────────────────────────────────────────────────────

    /**
     * @param latestCommitSha SHA of the most-recently synced commit (already in DB).
     *                        When a PR's headSha matches this, the task's overall CI
     *                        status is copied onto the PR row — avoids an extra API call.
     * @param latestCiStatus  resolved CI status string for {@code latestCommitSha}, or null.
     */
    private void persistPullRequests(Task task,
                                     List<GitHubTaskData.LinkedPr> incoming,
                                     String latestCommitSha,
                                     String latestCiStatus) {
        if (incoming == null || incoming.isEmpty()) return;

        // Delete-then-insert keeps the table in sync without complex diff logic.
        prRepository.deleteAllByTaskId(task.getId());
        prRepository.flush();

        LocalDateTime now = LocalDateTime.now();
        List<GithubPullRequest> entities = new ArrayList<>();
        for (GitHubTaskData.LinkedPr dto : incoming) {
            // CI status: copy from already-persisted commit when head SHAs match.
            String prCiStatus = null;
            if (!isBlank(dto.getHeadSha()) && dto.getHeadSha().equals(latestCommitSha)) {
                prCiStatus = latestCiStatus;
            }

            GithubPullRequest entity = new GithubPullRequest();
            entity.setTask(task);
            entity.setPrNumber(dto.getNumber());
            entity.setTitle(dto.getTitle());
            entity.setState(dto.getState());
            entity.setHtmlUrl(dto.getHtmlUrl());
            entity.setAuthor(dto.getAuthor());
            entity.setCreatedAt(dto.getCreatedAt());
            entity.setUpdatedAt(dto.getUpdatedAt());
            entity.setMergedAt(dto.getMergedAt());
            entity.setHeadBranch(dto.getHeadBranch());
            entity.setBaseBranch(dto.getBaseBranch());
            entity.setHeadSha(dto.getHeadSha());
            entity.setReviewStatus(dto.getReviewStatus());
            entity.setCiStatus(prCiStatus);
            entity.setSyncedAt(now);
            entities.add(entity);
        }
        prRepository.saveAll(entities);

        // Auto-assign the task's branch from the most-recent PR's head branch,
        // but only when the task doesn't already have one set manually.
        GitHubTaskData.LinkedPr first = incoming.get(0);
        if (!isBlank(first.getHeadBranch()) && isBlank(task.getGithubBranch())) {
            try {
                validateBranch(first.getHeadBranch());
                task.setGithubBranch(first.getHeadBranch());
                taskRepository.save(task);
            } catch (IllegalArgumentException ignored) {
                // Invalid branch name from GitHub — skip silently
            }
        }
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
        // Normalize the stored raw value to the canonical CiStatus name.
        // Returns null (no CI data) rather than "UNKNOWN" (CI exists but unclear)
        // so the frontend can distinguish "CI not configured" from "CI inconclusive".
        String ciStatus = commits.stream()
                .filter(c -> c.getCiStatus() != null)
                .findFirst()
                .map(c -> {
                    CiStatus normalized = ciStatusResolver.resolveFromStoredValue(c.getCiStatus());
                    return (normalized == CiStatus.UNKNOWN) ? null : normalized.name();
                })
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
        String normalizedCiStatus = null;
        if (pr.getCiStatus() != null) {
            CiStatus resolved = ciStatusResolver.resolveFromStoredValue(pr.getCiStatus());
            normalizedCiStatus = (resolved == CiStatus.UNKNOWN) ? null : resolved.name();
        }
        return TaskGithubSummaryDTO.PullRequestItem.builder()
                .id(pr.getId())
                .prNumber(pr.getPrNumber())
                .title(pr.getTitle())
                .state(pr.getState())
                .ciStatus(normalizedCiStatus)
                .reviewStatus(pr.getReviewStatus())
                .htmlUrl(pr.getHtmlUrl())
                .author(pr.getAuthor())
                .createdAt(pr.getCreatedAt())
                .updatedAt(pr.getUpdatedAt())
                .mergedAt(pr.getMergedAt())
                .headBranch(pr.getHeadBranch())
                .baseBranch(pr.getBaseBranch())
                .build();
    }

    /**
     * Converts a {@link GithubPullRequest} entity to the standalone
     * {@link LinkedPrResponseDTO} used by the dedicated PR-list endpoint.
     */
    public LinkedPrResponseDTO toLinkedPrResponseDTO(GithubPullRequest pr) {
        String normalizedCiStatus = null;
        if (pr.getCiStatus() != null) {
            CiStatus resolved = ciStatusResolver.resolveFromStoredValue(pr.getCiStatus());
            normalizedCiStatus = (resolved == CiStatus.UNKNOWN) ? null : resolved.name();
        }
        return LinkedPrResponseDTO.builder()
                .id(pr.getId())
                .prNumber(pr.getPrNumber())
                .title(pr.getTitle())
                .state(pr.getState())
                .ciStatus(normalizedCiStatus)
                .reviewStatus(pr.getReviewStatus())
                .headBranch(pr.getHeadBranch())
                .baseBranch(pr.getBaseBranch())
                .htmlUrl(pr.getHtmlUrl())
                .author(pr.getAuthor())
                .createdAt(pr.getCreatedAt())
                .updatedAt(pr.getUpdatedAt())
                .mergedAt(pr.getMergedAt())
                .build();
    }

    /**
     * Returns all PRs linked to a task, sorted by most-recently-updated, as
     * {@link LinkedPrResponseDTO} objects. DB-only — no GitHub API call.
     */
    @Transactional(readOnly = true)
    public List<LinkedPrResponseDTO> getLinkedPrs(Long taskId) {
        if (!taskRepository.existsById(taskId)) {
            throw new ResourceNotFoundException("Task not found");
        }
        return prRepository.findByTaskId(taskId).stream()
                .map(this::toLinkedPrResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Syncs fresh PR data from GitHub then returns the updated PR list.
     * Used by the endpoint when a token + repo are provided.
     */
    public List<LinkedPrResponseDTO> syncAndGetLinkedPrs(Long taskId,
                                                          String repoFullName,
                                                          String githubToken) {
        syncFromGitHub(taskId, repoFullName, githubToken);
        return getLinkedPrs(taskId);
    }

    private TaskGithubSummaryDTO.CommitItem toCommitItem(GithubCommit c) {
        String sha = c.getSha();
        String shortSha = (sha != null && sha.length() >= 7) ? sha.substring(0, 7) : sha;

        // Normalize per-commit CI status — handles both old raw values and new enum names.
        String normalizedCiStatus = null;
        if (c.getCiStatus() != null) {
            CiStatus resolved = ciStatusResolver.resolveFromStoredValue(c.getCiStatus());
            normalizedCiStatus = (resolved == CiStatus.UNKNOWN) ? null : resolved.name();
        }

        return TaskGithubSummaryDTO.CommitItem.builder()
                .id(c.getId())
                .sha(shortSha)
                .message(c.getMessage())
                .author(c.getAuthor())
                .committedAt(c.getCommittedAt())
                .htmlUrl(c.getHtmlUrl())
                .ciStatus(normalizedCiStatus)
                .build();
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    /**
     * Validates that a branch name is non-blank, within the 255-char column limit,
     * and contains only characters that are legal in Git branch names.
     *
     * @throws IllegalArgumentException when the branch name is invalid
     */
    private void validateBranch(String branch) {
        if (isBlank(branch)) {
            throw new IllegalArgumentException("Branch name must not be blank");
        }
        if (branch.length() > 255) {
            throw new IllegalArgumentException("Branch name must not exceed 255 characters");
        }
        if (!branch.matches("[a-zA-Z0-9._/\\-]+")) {
            throw new IllegalArgumentException(
                    "Branch name may only contain letters, digits, hyphens, underscores, dots, and forward slashes");
        }
    }
}
