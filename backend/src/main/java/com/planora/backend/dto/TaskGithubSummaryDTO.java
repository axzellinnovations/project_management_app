package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Aggregated GitHub summary for a single Planora task.
 * Built by TaskGithubService and used both:
 *   - as the body of GET /api/tasks/{taskId}/github (dedicated endpoint)
 *   - as the source for the github* fields in TaskResponseDTO (via TaskService#mapToDTO)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TaskGithubSummaryDTO {

    private Long   taskId;
    private String githubBranch;
    private int    prCount;
    private String ciStatus;        // "success" | "failure" | "pending" | null

    private List<PullRequestItem> pullRequests;
    private List<CommitItem>      commits;

    // ── Nested item DTOs ─────────────────────────────────────────────────────────

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PullRequestItem {
        private Long   id;
        private int    prNumber;
        private String title;
        private String state;           // "open" | "closed" | "merged"
        private String htmlUrl;
        private String author;
        private String createdAt;
        private String mergedAt;
        private String headBranch;
        private String baseBranch;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CommitItem {
        private Long   id;
        private String sha;             // 7-char short SHA for display
        private String message;
        private String author;
        private String committedAt;
        private String htmlUrl;
        private String ciStatus;        // commit-level CI result
    }
}
