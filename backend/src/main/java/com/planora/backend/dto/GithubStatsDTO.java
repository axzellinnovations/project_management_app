package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GithubStatsDTO {

    private boolean connected;
    private String  repoFullName;
    private String  defaultBranch;
    private long    openPrCount;
    private long    mergedPrCount;
    private long    totalCommits;
    private long    openIssues;
    private long    closedIssues;
    private String  latestCiStatus;     // "PASSING" | "FAILED" | "RUNNING" | null
    private String  connectedAt;
}
