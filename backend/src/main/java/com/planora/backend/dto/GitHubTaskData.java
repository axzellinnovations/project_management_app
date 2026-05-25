package com.planora.backend.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

/**
 * Immutable carrier for live GitHub data fetched for a single task.
 * Built by GitHubIntegrationService and consumed by TaskService#mapToDTO.
 * All fields are nullable so callers can safely handle a partially-populated object.
 */
@Value
@Builder
public class GitHubTaskData {

    int prCount;
    String ciStatus;
    List<LinkedPr> linkedPrs;
    List<RecentCommit> recentCommits;

    /** Lightweight PR summary — only the fields shown in the task detail panel. */
    @Value
    @Builder
    public static class LinkedPr {
        int    number;
        String title;
        String state;           // "open" | "closed" | "merged"
        String htmlUrl;
        String author;
        String createdAt;       // ISO-8601 string from GitHub API
        String updatedAt;       // ISO-8601 string — used for sort order
        String mergedAt;        // ISO-8601 string, null when not merged
        String headBranch;      // source branch
        String baseBranch;      // target branch
        String headSha;         // full 40-char SHA of PR's head commit
        String reviewStatus;    // "APPROVED"|"CHANGES_REQUESTED"|"REVIEW_REQUIRED"|"COMMENTED"|null
    }

    /** Lightweight commit summary — full SHA stored internally, display-truncated by the mapper. */
    @Value
    @Builder
    public static class RecentCommit {
        String sha;         // full 40-char SHA; mapper truncates to 7 chars for the response DTO
        String message;     // first line of the commit message
        String author;
        String date;
        String htmlUrl;
    }
}
