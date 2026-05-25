package com.planora.backend.controller;

import com.planora.backend.dto.GithubIssueDTO;
import com.planora.backend.dto.GithubStatsDTO;
import com.planora.backend.model.GithubCommit;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.GithubPullRequest;
import com.planora.backend.model.Task;
import com.planora.backend.repository.GithubCommitRepository;
import com.planora.backend.repository.GithubIssueRepository;
import com.planora.backend.repository.GithubPullRequestRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.service.GithubIssueService;
import com.planora.backend.service.GithubSyncService;
import com.planora.backend.service.GithubTokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Exposes read-only GitHub data for a project and supports manual sync + issue creation.
 *
 * Endpoints:
 *   GET    /api/github/projects/{projectId}/issues    — list cached issues
 *   POST   /api/github/projects/{projectId}/issues    — create a GitHub issue
 *   GET    /api/github/projects/{projectId}/stats     — aggregated stats
 *   POST   /api/github/projects/{projectId}/sync      — trigger immediate sync
 */
@RestController
@RequestMapping("/api/github/projects/{projectId}")
public class GithubDataController {

    @Autowired private GithubIssueService          issueService;
    @Autowired private GithubSyncService           syncService;
    @Autowired private GithubTokenService          tokenService;
    @Autowired private GithubIssueRepository       issueRepository;
    @Autowired private GithubPullRequestRepository prRepository;
    @Autowired private GithubCommitRepository      commitRepository;
    @Autowired private TaskRepository              taskRepository;

    @GetMapping("/issues")
    public ResponseEntity<List<GithubIssueDTO>> getIssues(@PathVariable Long projectId) {
        return ResponseEntity.ok(issueService.getIssuesForProject(projectId));
    }

    @PostMapping("/issues")
    public ResponseEntity<?> createIssue(
            @PathVariable Long projectId,
            @RequestBody Map<String, String> body) {

        String title = body.get("title");
        String text  = body.get("body");

        if (title == null || title.isBlank()) {
            return ResponseEntity.badRequest().body("title is required");
        }

        Optional<GithubIntegration> integration = tokenService.getIntegration(projectId);
        if (integration.isEmpty()) {
            return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                    .body("No GitHub repository connected for this project");
        }

        GithubIssueDTO created = issueService.createIssue(
                projectId, title, text,
                integration.get().getRepoFullName(),
                integration.get().getGithubToken());

        if (created == null) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body("Failed to create issue on GitHub");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/stats")
    public ResponseEntity<GithubStatsDTO> getStats(@PathVariable Long projectId) {
        Optional<GithubIntegration> integration = tokenService.getIntegration(projectId);

        if (integration.isEmpty()) {
            return ResponseEntity.ok(GithubStatsDTO.builder().connected(false).build());
        }

        GithubIntegration i = integration.get();

        // PRs and commits are task-scoped; gather task IDs for this project first.
        List<Long> taskIds = taskRepository.findByProjectIdAndGithubBranchNotNull(projectId)
                .stream().map(Task::getId).collect(Collectors.toList());

        List<GithubPullRequest> allPrs = taskIds.isEmpty()
                ? List.of()
                : prRepository.findAllByTaskIds(taskIds);
        List<GithubCommit> allCommits = taskIds.isEmpty()
                ? List.of()
                : commitRepository.findAllByTaskIds(taskIds);

        long openPrs    = allPrs.stream().filter(p -> "open".equals(p.getState())).count();
        long mergedPrs  = allPrs.stream().filter(p -> "merged".equals(p.getState())).count();
        long commits    = allCommits.size();
        long openIssues = issueRepository.countOpenByProjectId(projectId);
        long allIssues  = issueRepository.findByProjectId(projectId).size();

        return ResponseEntity.ok(GithubStatsDTO.builder()
                .connected(true)
                .repoFullName(i.getRepoFullName())
                .openPrCount(openPrs)
                .mergedPrCount(mergedPrs)
                .totalCommits(commits)
                .openIssues(openIssues)
                .closedIssues(allIssues - openIssues)
                .connectedAt(i.getConnectedAt().toString())
                .build());
    }

    @PostMapping("/sync")
    public ResponseEntity<String> triggerSync(@PathVariable Long projectId) {
        if (!tokenService.isConnected(projectId)) {
            return ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                    .body("No GitHub repository connected for this project");
        }
        syncService.syncProject(projectId);
        return ResponseEntity.ok("sync_started");
    }
}
