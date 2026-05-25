package com.planora.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.planora.backend.dto.GitHubTaskData;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Fetches live GitHub data (pull requests, commits, CI status) for a single task.
 *
 * Design decisions:
 *  - Uses RestTemplate for simplicity; swap for WebClient if async/reactive is needed later.
 *  - Every GitHub API call is wrapped in a try/catch so a rate-limit or network hiccup
 *    never breaks the task-detail response — GitHub fields degrade gracefully to null/empty.
 *  - No Spring beans are injected here, so there is zero risk of circular dependency.
 *  - The caller (TaskService) is responsible for providing the per-user GitHub token;
 *    this service is stateless and token-agnostic.
 */
@Service
public class GitHubIntegrationService {

    private static final String GITHUB_API = "https://api.github.com";
    private static final int MAX_ITEMS = 5;

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Returns a populated {@link GitHubTaskData} for the given repo + branch, or
     * {@code null} when any required argument is missing or blank.
     *
     * @param repoFullName  "owner/repo" string (e.g. "acme/frontend")
     * @param branch        branch name stored on the task (e.g. "feature/task-42")
     * @param githubToken   personal access token or OAuth token from the request header
     */
    public GitHubTaskData fetchTaskGitHubData(String repoFullName,
                                               String branch,
                                               String githubToken) {
        if (isBlank(repoFullName) || isBlank(branch) || isBlank(githubToken)) {
            return null;
        }

        String[] parts = repoFullName.split("/", 2);
        if (parts.length != 2 || isBlank(parts[0]) || isBlank(parts[1])) {
            return null;
        }
        String owner = parts[0];
        String repo  = parts[1];

        HttpHeaders headers = buildHeaders(githubToken);

        List<GitHubTaskData.LinkedPr>     linkedPrs     = fetchLinkedPRs(owner, repo, branch, headers);
        List<GitHubTaskData.RecentCommit> recentCommits = fetchRecentCommits(owner, repo, branch, headers);
        String                            ciStatus      = resolveCiStatus(owner, repo, recentCommits, headers);

        return GitHubTaskData.builder()
                .prCount(linkedPrs.size())
                .linkedPrs(linkedPrs)
                .recentCommits(recentCommits)
                .ciStatus(ciStatus)
                .build();
    }

    // ── Private helpers ───────────────────────────────────────────────────────────

    private List<GitHubTaskData.LinkedPr> fetchLinkedPRs(String owner, String repo,
                                                          String branch, HttpHeaders headers) {
        // Filter by head branch so only PRs from this exact branch are returned.
        String url = GITHUB_API + "/repos/" + owner + "/" + repo
                + "/pulls?head=" + owner + ":" + branch
                + "&state=all&per_page=" + MAX_ITEMS;

        try {
            ResponseEntity<JsonNode> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class);
            JsonNode body = response.getBody();
            if (body == null || !body.isArray()) return Collections.emptyList();

            List<GitHubTaskData.LinkedPr> result = new ArrayList<>();
            for (JsonNode pr : body) {
                // Treat merged PRs as "merged" rather than "closed" for display clarity.
                boolean isMerged = !pr.path("merged_at").isNull();
                String state = isMerged ? "merged" : pr.path("state").asText("open");
                result.add(GitHubTaskData.LinkedPr.builder()
                        .number(pr.path("number").asInt())
                        .title(pr.path("title").asText(""))
                        .state(state)
                        .htmlUrl(pr.path("html_url").asText(""))
                        .author(pr.path("user").path("login").asText(""))
                        .createdAt(pr.path("created_at").asText(""))
                        .mergedAt(isMerged ? pr.path("merged_at").asText(null) : null)
                        .headBranch(pr.path("head").path("ref").asText(""))
                        .baseBranch(pr.path("base").path("ref").asText(""))
                        .build());
            }
            return result;
        } catch (RestClientException ignored) {
            return Collections.emptyList();
        }
    }

    private List<GitHubTaskData.RecentCommit> fetchRecentCommits(String owner, String repo,
                                                                   String branch, HttpHeaders headers) {
        String url = GITHUB_API + "/repos/" + owner + "/" + repo
                + "/commits?sha=" + branch + "&per_page=" + MAX_ITEMS;

        try {
            ResponseEntity<JsonNode> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class);
            JsonNode body = response.getBody();
            if (body == null || !body.isArray()) return Collections.emptyList();

            List<GitHubTaskData.RecentCommit> result = new ArrayList<>();
            for (JsonNode c : body) {
                JsonNode commitMeta  = c.path("commit");
                JsonNode authorMeta  = commitMeta.path("author");
                String   fullSha     = c.path("sha").asText("");
                // Store only first line of commit message to keep the DTO compact.
                String   firstLine   = commitMeta.path("message").asText("").split("\n")[0];

                result.add(GitHubTaskData.RecentCommit.builder()
                        .sha(fullSha)           // full SHA; mapper trims to 7 chars for the response
                        .message(firstLine)
                        .author(authorMeta.path("name").asText(""))
                        .date(authorMeta.path("date").asText(""))
                        .htmlUrl(c.path("html_url").asText(""))
                        .build());
            }
            return result;
        } catch (RestClientException ignored) {
            return Collections.emptyList();
        }
    }

    /**
     * Derives a single CI status string from the GitHub Check Runs API for the
     * latest commit on the branch. Returns one of: "success", "failure", "pending", or null.
     */
    private String resolveCiStatus(String owner, String repo,
                                    List<GitHubTaskData.RecentCommit> commits,
                                    HttpHeaders headers) {
        if (commits.isEmpty() || isBlank(commits.get(0).getSha())) return null;

        String latestSha = commits.get(0).getSha();
        String url = GITHUB_API + "/repos/" + owner + "/" + repo
                + "/commits/" + latestSha + "/check-runs";

        try {
            ResponseEntity<JsonNode> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class);
            JsonNode body = response.getBody();
            if (body == null) return null;

            JsonNode runs = body.path("check_runs");
            if (!runs.isArray() || runs.isEmpty()) return null;

            boolean anyPending = false;
            for (JsonNode run : runs) {
                String status     = run.path("status").asText("");
                String conclusion = run.path("conclusion").asText("");

                // Any hard failure short-circuits the whole status.
                if ("failure".equals(conclusion) || "cancelled".equals(conclusion)
                        || "timed_out".equals(conclusion) || "action_required".equals(conclusion)) {
                    return "failure";
                }
                if ("in_progress".equals(status) || "queued".equals(status)
                        || "waiting".equals(status) || "pending".equals(status)) {
                    anyPending = true;
                }
            }
            return anyPending ? "pending" : "success";

        } catch (RestClientException ignored) {
            return null;
        }
    }

    private HttpHeaders buildHeaders(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        headers.set(HttpHeaders.ACCEPT, "application/vnd.github.v3+json");
        return headers;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
