package com.planora.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.planora.backend.dto.GithubCommitDTO;
import com.planora.backend.model.GithubCommit;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.repository.GithubCommitRepository;
import com.planora.backend.repository.GithubIntegrationRepository;
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
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GithubCommitService {

    private final GithubApiClient githubApiClient;
    private final GithubTokenService githubTokenService;
    private final GithubIntegrationRepository integrationRepository;
    private final GithubCommitRepository commitRepository;
    private final TaskRepository taskRepository;

    @Transactional
    public Page<GithubCommitDTO> getCommits(Long projectId, int page, int size) {
        return getCommits(projectId, page, size, null);
    }

    @Transactional
    public Page<GithubCommitDTO> getCommits(Long projectId, int page, int size, Long userId) {
        List<GithubIntegration> integrations = integrationRepository.findByProjectIdAndActiveTrue(projectId);
        if (integrations.isEmpty()) return Page.empty();

        List<Long> ids = integrations.stream().map(GithubIntegration::getId).collect(Collectors.toList());

        // Proactive sync for any integration that has no commits cached yet
        for (GithubIntegration integration : integrations) {
            if (commitRepository.countByIntegrationId(integration.getId()) == 0) {
                ensureIntegrationToken(integration, userId);
                if (githubTokenService.hasValidToken(integration)) {
                    try {
                        syncCommits(integration);
                    } catch (Exception e) {
                        log.warn("Proactive commit sync failed for integration {}: {}", integration.getId(), e.getMessage());
                    }
                }
            }
        }

        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "authoredAt"));
        return commitRepository.findByIntegrationIdIn(ids, pageRequest).map(this::toDTO);
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
    public void syncCommits(GithubIntegration integration) {
        String token = githubTokenService.resolveToken(integration);
        String repo = integration.getRepositoryFullName();
        log.info("Syncing commits for {}", repo);

        try {
            List<JsonNode> commits = githubApiClient.fetchCommits(repo, token, 1, 100);
            commits.forEach(node -> {
                try {
                    upsertCommit(integration, node);
                } catch (Exception ex) {
                    log.warn("Failed to upsert commit for {}: {}", repo, ex.getMessage());
                }
            });
            log.info("Commit sync complete for {} ({} fetched)", repo, commits.size());
        } catch (Exception e) {
            log.warn("Commit sync failed for {}: {}", repo, e.getMessage());
        }
    }

    @Transactional
    public void upsertCommit(GithubIntegration integration, JsonNode node) {
        String sha = node.path("sha").asText();
        if (sha.isBlank()) return;

        Optional<GithubCommit> existing = commitRepository.findByIntegrationIdAndSha(integration.getId(), sha);
        GithubCommit commit = existing.orElse(new GithubCommit());
        commit.setIntegration(integration);
        commit.setSha(sha);

        JsonNode commitNode = node.path("commit");
        String message = commitNode.path("message").asText("No commit message");
        commit.setMessage(message);

        String authorName = commitNode.path("author").path("name").asText(null);
        if (authorName == null || authorName.isBlank()) {
            authorName = commitNode.path("committer").path("name").asText(null);
        }
        String authorLogin = node.path("author").path("login").asText(null);
        if (authorLogin == null || authorLogin.isBlank()) {
            authorLogin = node.path("committer").path("login").asText(null);
        }
        String finalAuthor = (authorLogin != null && !authorLogin.isBlank())
                ? authorLogin
                : (authorName != null && !authorName.isBlank() ? authorName : "unknown");
        commit.setAuthorName(authorName != null ? authorName : finalAuthor);
        commit.setAuthor(finalAuthor);

        String authorEmail = commitNode.path("author").path("email").asText(null);
        if (authorEmail == null || authorEmail.isBlank()) {
            authorEmail = commitNode.path("committer").path("email").asText(null);
        }
        commit.setAuthorEmail(authorEmail);

        String dateStr = commitNode.path("author").path("date").asText(null);
        if (dateStr == null || dateStr.isBlank()) {
            dateStr = commitNode.path("committer").path("date").asText(null);
        }
        LocalDateTime authoredAt = parseDateTime(dateStr);
        if (authoredAt == null) {
            authoredAt = LocalDateTime.now();
        }
        commit.setAuthoredAt(authoredAt);
        commit.setCommittedAt(dateStr != null ? dateStr : authoredAt.toString());

        String htmlUrl = node.path("html_url").asText(null);
        commit.setCommitUrl(htmlUrl);
        commit.setHtmlUrl(htmlUrl);
        commit.setSyncedAt(LocalDateTime.now());

        if (commit.getTask() == null || commit.getLinkedTaskId() == null) {
            Task task = resolveTaskRef(integration.getProject(), message);
            if (task != null) {
                commit.setTask(task);
                commit.setLinkedTaskId(task.getId());
            }
        }
        commitRepository.save(commit);
    }

    @Transactional(readOnly = true)
    public List<GithubCommitDTO> getCommitsForTask(Long taskId) {
        return commitRepository.findByTaskId(taskId)
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

    private GithubCommitDTO toDTO(GithubCommit commit) {
        String sha = commit.getSha();
        String author = commit.getAuthorName() != null ? commit.getAuthorName() : commit.getAuthor();
        String commitUrl = commit.getCommitUrl() != null ? commit.getCommitUrl() : commit.getHtmlUrl();
        return GithubCommitDTO.builder()
            .id(commit.getId())
            .integrationId(commit.getIntegration() != null ? commit.getIntegration().getId() : null)
            .sha(sha)
            .shortSha(sha != null && sha.length() >= 7 ? sha.substring(0, 7) : sha)
            .message(commit.getMessage())
            .authorName(author)
            .authorEmail(commit.getAuthorEmail())
            .commitUrl(commitUrl)
            .linkedTaskId(commit.getLinkedTaskId() != null ? commit.getLinkedTaskId() : (commit.getTask() != null ? commit.getTask().getId() : null))
            .authoredAt(commit.getAuthoredAt())
            .build();
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) return null;
        try { return OffsetDateTime.parse(value).toLocalDateTime(); } catch (Exception e) { return null; }
    }
}

