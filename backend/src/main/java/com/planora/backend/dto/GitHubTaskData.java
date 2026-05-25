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
        int number;
        String title;
        String state;       // "open" | "closed" | "merged"
        String htmlUrl;
        String author;
        String createdAt;
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
