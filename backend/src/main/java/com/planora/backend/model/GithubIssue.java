package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "github_issues")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GithubIssue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "issue_number", nullable = false)
    private int issueNumber;

    @Column(length = 500)
    private String title;

    @Column(length = 20)
    private String state;       // "open" | "closed"

    @Column(name = "html_url", length = 1000)
    private String htmlUrl;

    @Column(length = 255)
    private String author;

    @Column(length = 5000)
    private String body;

    @Column(name = "created_at", length = 30)
    private String createdAt;

    @Column(name = "closed_at", length = 30)
    private String closedAt;

    @Column(name = "synced_at", nullable = false)
    private LocalDateTime syncedAt;
}
