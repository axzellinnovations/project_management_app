package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GithubCommitDTO {

    private Long   id;
    private String sha;         // 7-char short SHA for display
    private String fullSha;     // full 40-char SHA
    private String message;
    private String author;
    private String committedAt;
    private String htmlUrl;
    private String ciStatus;    // "PASSING" | "FAILED" | "RUNNING" | null
}
