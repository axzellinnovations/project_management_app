package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GithubIssueDTO {

    private Long   id;
    private int    issueNumber;
    private String title;
    private String state;       // "open" | "closed"
    private String htmlUrl;
    private String author;
    private String body;
    private String createdAt;
    private String closedAt;
}
