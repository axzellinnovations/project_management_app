package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GithubPrDTO {

    private Long   id;
    private int    prNumber;
    private String title;
    private String state;           // "open" | "closed" | "merged"
    private String ciStatus;        // "PASSING" | "FAILED" | "RUNNING" | null
    private String reviewStatus;    // "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | "COMMENTED" | null
    private String htmlUrl;
    private String author;
    private String createdAt;
    private String updatedAt;
    private String mergedAt;
    private String headBranch;
    private String baseBranch;
    private String headSha;
}
