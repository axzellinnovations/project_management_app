package com.planora.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Persisted snapshot of a GitHub pull request linked to a Planora task.
 * Rows are written (upserted) by TaskGithubService whenever a GitHub sync runs.
 * Queried by GithubPullRequestRepository — never lazy-loaded through Task to
 * avoid adding an @OneToMany collection that would widen every task fetch.
 */
@Entity
@Table(name = "github_pull_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GithubPullRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    @JsonIgnore
    private Task task;

    @Column(name = "pr_number", nullable = false)
    private int prNumber;

    @Column(length = 500)
    private String title;

    @Column(length = 20)
    private String state;           // "open" | "closed" | "merged"

    @Column(name = "html_url", length = 1000)
    private String htmlUrl;

    @Column(length = 255)
    private String author;

    @Column(name = "created_at", length = 30)
    private String createdAt;       // ISO-8601 string from GitHub API

    @Column(name = "merged_at", length = 30)
    private String mergedAt;        // null when not merged

    @Column(name = "head_branch", length = 255)
    private String headBranch;

    @Column(name = "base_branch", length = 255)
    private String baseBranch;

    @Column(name = "synced_at", nullable = false)
    private LocalDateTime syncedAt;

    // ── Enrichment fields added in V24 ───────────────────────────────────────────

    @Column(name = "head_sha", length = 40)
    private String headSha;          // full SHA of PR's head commit — used for CI cross-reference

    @Column(name = "updated_at", length = 30)
    private String updatedAt;        // ISO-8601 string from GitHub — used for sort order

    @Column(name = "ci_status", length = 20)
    private String ciStatus;         // "PASSING" | "FAILED" | "RUNNING" | null

    @Column(name = "review_status", length = 30)
    private String reviewStatus;     // "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | "COMMENTED" | null
}
