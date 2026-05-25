package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "github_integrations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GithubIntegration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "repo_full_name", nullable = false, length = 255)
    private String repoFullName;

    @Column(length = 128)
    private String owner;

    @Column(name = "repo_name", length = 128)
    private String repoName;

    @Column(name = "github_token", length = 512)
    private String githubToken;

    @Column(name = "connected_by_user_id")
    private Long connectedByUserId;

    @Column(name = "connected_at", nullable = false)
    private LocalDateTime connectedAt;

    @Column(nullable = false)
    private boolean active = true;
}
