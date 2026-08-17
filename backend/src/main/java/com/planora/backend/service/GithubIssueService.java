package com.planora.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.planora.backend.dto.GithubIssueDTO;
import com.planora.backend.dto.GithubLabelDTO;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.GithubIssue;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.repository.GithubIntegrationRepository;
import com.planora.backend.repository.GithubIssueRepository;
import com.planora.backend.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GithubIssueService {

    private final GithubApiClient githubApiClient;
    private final GithubTokenService githubTokenService;
    private final GithubIntegrationRepository integrationRepository;
    private final GithubIssueRepository issueRepository;
    private final TaskRepository taskRepository;

    @Transactional
    public Page<GithubIssueDTO> getIssues(Long projectId, String state, int page, int size) {
        return getIssues(projectId, state, page, size, null);
    }

    @Transactional
    public Page<GithubIssueDTO> getIssues(Long projectId, String state, int page, int size, Long userId) {
        List<GithubIntegration> integrations = integrationRepository.findByProjectIdAndActiveTrue(projectId);
        if (integrations.isEmpty()) return Page.empty();

        List<Long> ids = integrations.stream().map(GithubIntegration::getId).collect(Collectors.toList());

        // Proactive sync for any integration that has no issues cached yet
        for (GithubIntegration integration : integrations) {
            if (issueRepository.countByIntegrationId(integration.getId()) == 0) {
                ensureIntegrationToken(integration, userId);
                if (githubTokenService.hasValidToken(integration)) {
                    try {
                        syncIssues(integration);
                    } catch (Exception e) {
                        log.warn("Proactive issue sync failed for integration {}: {}", integration.getId(), e.getMessage());
                    }
                }
            }
        }

        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "githubCreatedAt"));
        Page<GithubIssue> issues = "all".equalsIgnoreCase(state)
            ? issueRepository.findByIntegrationIdIn(ids, pageRequest)
            : issueRepository.findByIntegrationIdInAndState(ids, state.toLowerCase(), pageRequest);

        return issues.map(this::toDTO);
    }

    private void ensureIntegrationToken(GithubIntegration integration, Long userId) {
        if (!githubTokenService.hasValidToken(integration) && userId != null) {
            try {
                String userToken = githubTokenService.getToken(userId);
                if (userToken != null && !userToken.isBlank()) {
                    integration.setEncryptedAccessToken(githubTokenService.encryptToken(userToken));
                    integrationRepository.save(integration);
                }
            } catch (Exception e) {
                log.debug("Could not backfill integration token from user {}: {}", userId, e.getMessage());
            }
        }
    }

    @Transactional
    public void syncIssues(GithubIntegration integration) {
        String token = githubTokenService.resolveToken(integration);
        String repo = integration.getRepositoryFullName();
        log.info("Syncing issues for {}", repo);

        List<JsonNode> nodes = githubApiClient.fetchIssues(repo, token, "all", 1, 100);
        for (JsonNode node : nodes) {
            // GitHub issues endpoint also returns PRs; skip them
            if (node.hasNonNull("pull_request") || !node.path("pull_request").isMissingNode()) continue;
            upsertIssue(integration, node);
        }

        log.info("Issue sync complete for {}", repo);
    }

    @Transactional
    public GithubIssueDTO createIssue(Long integrationId, String title, String body, List<String> labels) {
        GithubIntegration integration = integrationRepository.findById(integrationId)
            .orElseThrow(() -> new ResourceNotFoundException("Integration not found: " + integrationId));

        String token = githubTokenService.resolveToken(integration);
        JsonNode created = githubApiClient.createIssue(
            integration.getRepositoryFullName(), token, title, body, labels);

        upsertIssue(integration, created);
        int issueNumber = created.path("number").asInt();

        return issueRepository.findByIntegrationIdAndGithubIssueNumber(integrationId, issueNumber)
            .map(this::toDTO)
            .orElseThrow(() -> new RuntimeException("Issue created on GitHub but not saved locally"));
    }

    @Transactional
    public void upsertIssue(GithubIntegration integration, JsonNode node) {
        if (node == null) return;
        // Do not upsert pull requests into the issues table
        if (node.hasNonNull("pull_request") || !node.path("pull_request").isMissingNode()) return;

        int issueNumber = node.path("number").asInt();
        if (issueNumber <= 0) return;

        Optional<GithubIssue> existing = issueRepository
            .findByIntegrationIdAndGithubIssueNumber(integration.getId(), issueNumber);

        GithubIssue issue = existing.orElse(new GithubIssue());
        issue.setIntegration(integration);
        issue.setGithubIssueNumber(issueNumber);
        issue.setTitle(truncate(node.path("title").asText(""), 500));
        issue.setBody(node.path("body").asText(null));
        issue.setState(node.path("state").asText("open"));
        issue.setAuthorLogin(node.path("user").path("login").asText(null));
        issue.setGithubUrl(node.path("html_url").asText(null));
        issue.setGithubCreatedAt(parseDateTime(node.path("created_at").asText(null)));
        issue.setGithubUpdatedAt(parseDateTime(node.path("updated_at").asText(null)));
        issue.setSyncedAt(LocalDateTime.now());

        List<String> labelEntries = new ArrayList<>();
        node.path("labels").forEach(label -> {
            String name = label.path("name").asText("");
            String color = label.path("color").asText("");
            if (!name.isBlank()) {
                labelEntries.add(color.isBlank() ? name : name + ":" + color);
            }
        });
        issue.setLabelNames(String.join(",", labelEntries));

        if (issue.getLinkedTaskId() == null) {
            Task task = resolveTaskRef(integration.getProject(), issue.getTitle() + " " + issue.getBody());
            if (task != null) {
                issue.setLinkedTaskId(task.getId());
            }
        }

        issueRepository.save(issue);
    }

    @Transactional(readOnly = true)
    public List<GithubIssueDTO> getIssuesForTask(Long taskId) {
        return issueRepository.findByLinkedTaskId(taskId)
            .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public Task resolveTaskRef(Project project, String text) {
        if (project == null || text == null || text.isBlank()) return null;

        Long projectId;
        String projectKey;
        try {
            projectId = project.getId();
            projectKey = project.getProjectKey() != null ? project.getProjectKey() : "TASK";
        } catch (Exception e) {
            log.debug("Could not resolve project details from proxy: {}", e.getMessage());
            return null;
        }
        if (projectId == null) return null;

        Pattern pattern = Pattern.compile(
            "(?:#|" + Pattern.quote(projectKey) + "-|TASK-|task/|issue/|feature/)(\\d+)",
            Pattern.CASE_INSENSITIVE
        );
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            try {
                long num = Long.parseLong(matcher.group(1));
                // 1. Try project-scoped task number
                Optional<Task> taskByNum = taskRepository.findByProjectIdAndProjectTaskNumber(projectId, num);
                if (taskByNum.isPresent()) {
                    return taskByNum.get();
                }
                // 2. Try global task ID if it belongs to this project
                Optional<Task> taskById = taskRepository.findById(num);
                if (taskById.isPresent() && taskById.get().getProject() != null
                        && projectId.equals(taskById.get().getProject().getId())) {
                    return taskById.get();
                }
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }

    private GithubIssueDTO toDTO(GithubIssue issue) {
        List<GithubLabelDTO> labels = (issue.getLabelNames() != null && !issue.getLabelNames().isBlank())
            ? List.of(issue.getLabelNames().split(",")).stream()
                .filter(s -> !s.isBlank())
                .map(entry -> {
                    if (entry.contains(":")) {
                        String[] parts = entry.split(":", 2);
                        return new GithubLabelDTO(parts[0], parts[1].isBlank() ? null : parts[1]);
                    }
                    return new GithubLabelDTO(entry, null);
                })
                .toList()
            : List.of();
        return GithubIssueDTO.builder()
            .id(issue.getId())
            .integrationId(issue.getIntegration() != null ? issue.getIntegration().getId() : null)
            .githubIssueNumber(issue.getGithubIssueNumber())
            .number(issue.getGithubIssueNumber())
            .title(issue.getTitle())
            .body(issue.getBody())
            .state(issue.getState())
            .authorLogin(issue.getAuthorLogin())
            .githubUrl(issue.getGithubUrl())
            .htmlUrl(issue.getGithubUrl())
            .labels(labels)
            .linkedTaskId(issue.getLinkedTaskId())
            .githubCreatedAt(issue.getGithubCreatedAt())
            .githubUpdatedAt(issue.getGithubUpdatedAt())
            .build();
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) return null;
        try { return OffsetDateTime.parse(value).toLocalDateTime(); } catch (Exception e) { return null; }
    }

    private String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() > max ? value.substring(0, max) : value;
    }
}

