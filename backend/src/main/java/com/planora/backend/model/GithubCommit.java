package com.planora.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Persisted snapshot of a GitHub commit linked to a Planora task.
 * The full 40-char SHA is stored here; the service layer trims it to 7 chars
 * when building the response DTO so callers always receive a display-ready value.
 * The ci_status column holds the resolved conclusion of the check-runs for this
 * commit's SHA — populated by TaskGithubService during a GitHub sync.
 */
@Entity
@Table(name = "github_commits")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GithubCommit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    @JsonIgnore
    private Task task;

    @Column(length = 40, nullable = false)
    private String sha;             // full 40-char SHA

    @Column(length = 1000)
    private String message;         // first line of commit message

    @Column(length = 255)
    private String author;

    @Column(name = "committed_at", length = 30)
    private String committedAt;     // ISO-8601 string from GitHub API

    @Column(name = "html_url", length = 1000)
    private String htmlUrl;

    @Column(name = "ci_status", length = 20)
    private String ciStatus;        // "PASSING" | "FAILED" | "RUNNING" | null (normalized CiStatus name)

    @Column(name = "synced_at", nullable = false)
    private LocalDateTime syncedAt;
}
