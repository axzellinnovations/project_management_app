package com.planora.backend.controller;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.planora.backend.dto.GithubCommitDTO;
import com.planora.backend.dto.GithubCreateIssueRequestDTO;
import com.planora.backend.dto.GithubIssueDTO;
import com.planora.backend.dto.GithubLinkTaskRequestDTO;
import com.planora.backend.dto.PageResponseDto;
import com.planora.backend.dto.GithubPrDTO;
import com.planora.backend.dto.GithubStatsDTO;
import com.planora.backend.exception.GithubAuthenticationException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.repository.GithubIntegrationRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.GithubCommitService;
import com.planora.backend.service.GithubIssueService;
import com.planora.backend.service.GithubNotificationService;
import com.planora.backend.service.GithubPullRequestService;
import com.planora.backend.service.GithubSyncService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/github/project/{projectId}")
@RequiredArgsConstructor
public class GithubDataController {

    private final GithubPullRequestService pullRequestService;
    private final GithubCommitService commitService;
    private final GithubIssueService issueService;
    private final GithubSyncService syncService;
    private final GithubNotificationService githubNotificationService;
    private final GithubIntegrationRepository githubIntegrationRepository;
    private final UserRepository userRepository;

    @GetMapping("/pull-requests")
    public ResponseEntity<PageResponseDto<GithubPrDTO>> getPullRequests(
            @PathVariable Long projectId,
            @RequestParam(defaultValue = "all") String state,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal) {

        Long userId = principal != null ? principal.getUserId() : null;
        Page<GithubPrDTO> result = pullRequestService.getPullRequests(projectId, state, page, size, userId);
        return ResponseEntity.ok(PageResponseDto.from(result));
    }

    @GetMapping("/commits")
    public ResponseEntity<PageResponseDto<GithubCommitDTO>> getCommits(
            @PathVariable Long projectId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal) {

        Long userId = principal != null ? principal.getUserId() : null;
        Page<GithubCommitDTO> result = commitService.getCommits(projectId, page, size, userId);
        return ResponseEntity.ok(PageResponseDto.from(result));
    }

    @GetMapping("/issues")
    public ResponseEntity<PageResponseDto<GithubIssueDTO>> getIssues(
            @PathVariable Long projectId,
            @RequestParam(defaultValue = "open") String state,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal) {

        Long userId = principal != null ? principal.getUserId() : null;
        Page<GithubIssueDTO> result = issueService.getIssues(projectId, state, page, size, userId);
        return ResponseEntity.ok(PageResponseDto.from(result));
    }

    @GetMapping("/stats")
    public ResponseEntity<GithubStatsDTO> getStats(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserPrincipal principal) {

        GithubStatsDTO stats = syncService.getStats(projectId);
        return ResponseEntity.ok(stats);
    }

    @PostMapping("/sync")
    public ResponseEntity<Void> triggerSync(
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserPrincipal principal) {

        syncService.syncProject(projectId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/issues")
    public ResponseEntity<GithubIssueDTO> createIssue(
            @PathVariable Long projectId,
            @Valid @RequestBody GithubCreateIssueRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {

        User currentUser = userRepository.findById(principal.getUserId())
            .orElseThrow(() -> new GithubAuthenticationException("Authenticated user not found"));
        GithubIntegration integration = githubIntegrationRepository.findByIdAndProjectId(request.getIntegrationId(), projectId)
            .orElseThrow(() -> new ResourceNotFoundException("GitHub integration not found"));
        GithubIssueDTO created = issueService.createIssue(
            request.getIntegrationId(),
            request.getTitle(),
            request.getBody(),
            request.getLabels());
        Integer issueNumber = created.getNumber();
        githubNotificationService.notifyIssueEvent(
            integration.getRepositoryFullName(),
            issueNumber == null ? 0 : issueNumber,
            created.getTitle(),
            "opened",
            resolveActorLogin(currentUser),
            created.getBody(),
            request.getLabels() == null ? List.of() : request.getLabels().stream()
                .filter(Objects::nonNull)
                .filter(label -> !label.isBlank())
                .collect(Collectors.toList()));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/pull-requests/{prId}/link-task")
    public ResponseEntity<Void> linkTaskToPr(
            @PathVariable Long projectId,
            @PathVariable Long prId,
            @Valid @RequestBody GithubLinkTaskRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {

        pullRequestService.linkTaskToPr(prId, request.getTaskId());
        return ResponseEntity.ok().build();
    }

    private String resolveActorLogin(User user) {
        if (user.getGithubUsername() != null && !user.getGithubUsername().isBlank()) {
            return user.getGithubUsername();
        }
        return Objects.toString(user.getUsername(), "");
    }
}
