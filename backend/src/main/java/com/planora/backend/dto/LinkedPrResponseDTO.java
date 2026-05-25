package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Full pull-request response for GET /api/tasks/{taskId}/pull-requests.
 *
 * All PRs are sorted by most-recently-updated (updatedAt DESC).
 *
 * ciStatus values    : "PASSING" | "FAILED" | "RUNNING" | null (null = no CI data)
 * reviewStatus values: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | "COMMENTED" | null
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LinkedPrResponseDTO {

    private Long   id;
    private int    prNumber;
    private String title;
    private String state;           // "open" | "closed" | "merged"
    private String ciStatus;
    private String reviewStatus;
    private String headBranch;      // source branch
    private String baseBranch;      // target branch
    private String htmlUrl;
    private String author;
    private String createdAt;       // ISO-8601
    private String updatedAt;       // ISO-8601 — primary sort key
    private String mergedAt;        // ISO-8601, null when not merged
}
