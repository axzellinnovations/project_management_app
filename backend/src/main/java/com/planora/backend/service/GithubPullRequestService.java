package com.planora.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.planora.backend.dto.GithubPrDTO;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.GithubPullRequest;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.repository.GithubIntegrationRepository;
import com.planora.backend.repository.GithubPullRequestRepository;
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
public class GithubPullRequestService {

    private final GithubApiClient githubApiClient;
    private final GithubTokenService githubTokenService;
    private final GithubIntegrationRepository integrationRepository;
    private final GithubPullRequestRepository pullRequestRepository;
    private final TaskRepository taskRepository;

    @Transactional
    public Page<GithubPrDTO> getPullRequests(Long projectId, String state, int page, int size) {
        return getPullRequests(projectId, state, page, size, null);
    }

    @Transactional
    public Page<GithubPrDTO> getPullRequests(Long projectId, String state, int page, int size, Long userId) {
        List<GithubIntegration> integrations = integrationRepository.findByProjectIdAndActiveTrue(projectId);
        if (integrations.isEmpty()) return Page.empty();

        List<Long> ids = integrations.stream().map(GithubIntegration::getId).collect(Collectors.toList());

        // Proactive sync for any integration that has no PRs cached yet
        for (GithubIntegration integration : integrations) {
            if (pullRequestRepository.countByIntegrationId(integration.getId()) == 0) {
                ensureIntegrationToken(integration, userId);
                if (githubTokenService.hasValidToken(integration)) {
                    try {
                        syncPullRequests(integration);
                    } catch (Exception e) {
                        log.warn("Proactive PR sync failed for integration {}: {}", integration.getId(), e.getMessage());
                    }
                }
            }
        }

        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "githubCreatedAt"));
        Page<GithubPullRequest> prs = "all".equalsIgnoreCase(state)
            ? pullRequestRepository.findByIntegrationIdIn(ids, pageRequest)
            : pullRequestRepository.findByIntegrationIdInAndState(ids, state.toLowerCase(), pageRequest);

        return prs.map(this::toDTO);
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
    public void syncPullRequests(GithubIntegration integration) {
        String token = githubTokenService.resolveToken(integration);
        String repo = integration.getRepositoryFullName();
        log.info("Syncing pull requests for {}", repo);

        int page = 1;
        int maxPages = 2; // Bounded to 200 PRs to ensure fast sync and avoid rate limit exhaustion
        int fetched;
        do {
            try {
                List<JsonNode> nodes = githubApiClient.fetchPullRequests(repo, token, "all", page, 100);
                fetched = nodes.size();
                nodes.forEach(node -> {
                    try {
                        upsertPullRequest(integration, node);
                    } catch (Exception ex) {
                        log.warn("Failed to upsert PR #{} for {}: {}", node.path("number").asInt(), repo, ex.getMessage());
                    }
                });
                page++;
            } catch (Exception e) {
                log.warn("Failed to fetch PRs page {} for {}: {}", page, repo, e.getMessage());
                break;
            }
        } while (fetched == 100 && page <= maxPages);

        log.info("Pull request sync complete for {}", repo);
    }

    @Transactional
    public void upsertPullRequest(GithubIntegration integration, JsonNode node) {
        int prNumber = node.path("number").asInt();
        if (prNumber <= 0) return;

        Optional<GithubPullRequest> existing = pullRequestRepository
            .findByIntegrationIdAndGithubPrNumber(integration.getId(), prNumber);

        GithubPullRequest pr = existing.orElse(new GithubPullRequest());
        pr.setIntegration(integration);
        pr.setGithubPrNumber(prNumber);
        pr.setPrNumber(prNumber);
        pr.setTitle(truncate(node.path("title").asText("Untitled PR"), 500));
        pr.setBody(node.path("body").asText(null));
        pr.setState(resolvePrState(node));

        String authorLogin = node.path("user").path("login").asText(null);
        if (authorLogin == null || authorLogin.isBlank()) {
            authorLogin = "unknown";
        }
        pr.setAuthorLogin(authorLogin);
        pr.setAuthor(authorLogin);

        String headBranch = node.path("head").path("ref").asText("unknown");
        String baseBranch = node.path("base").path("ref").asText("unknown");
        String headSha = node.path("head").path("sha").asText(null);
        pr.setHeadBranch(headBranch);
        pr.setBaseBranch(baseBranch);
        pr.setHeadSha(headSha);

        String htmlUrl = node.path("html_url").asText(null);
        pr.setGithubUrl(htmlUrl);
        pr.setHtmlUrl(htmlUrl);

        String createdAtStr = node.path("created_at").asText(null);
        LocalDateTime createdAt = parseDateTime(createdAtStr);
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        pr.setGithubCreatedAt(createdAt);
        pr.setCreatedAt(createdAtStr != null ? createdAtStr : createdAt.toString());

        String updatedAtStr = node.path("updated_at").asText(null);
        LocalDateTime updatedAt = parseDateTime(updatedAtStr);
        if (updatedAt == null) {
            updatedAt = createdAt;
        }
        pr.setGithubUpdatedAt(updatedAt);
        pr.setUpdatedAt(updatedAtStr != null ? updatedAtStr : updatedAt.toString());

        String mergedAtStr = node.path("merged_at").asText(null);
        LocalDateTime mergedAt = parseDateTime(mergedAtStr);
        pr.setGithubMergedAt(mergedAt);
        pr.setMergedAt(mergedAt);
        pr.setSyncedAt(LocalDateTime.now());

        if (pr.getTask() == null || pr.getLinkedTaskId() == null) {
            Task task = resolveTaskRef(integration.getProject(), pr.getTitle() + " " + headBranch);
            if (task != null) {
                pr.setTask(task);
                pr.setLinkedTaskId(task.getId());
            }
        }
        pullRequestRepository.save(pr);
    }

    @Transactional
    public void linkTaskToPr(Long prId, Long taskId) {
        pullRequestRepository.findById(prId).ifPresent(pr -> {
            pr.setLinkedTaskId(taskId);
            taskRepository.findById(taskId).ifPresent(pr::setTask);
            pullRequestRepository.save(pr);
        });
    }

    @Transactional(readOnly = true)
    public List<GithubPrDTO> getPrsForTask(Long taskId) {
        return pullRequestRepository.findByTaskId(taskId)
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

    private String resolvePrState(JsonNode node) {
        String state = node.path("state").asText("open");
        JsonNode mergedAt = node.path("merged_at");
        if ("closed".equals(state) && !mergedAt.isNull() && !mergedAt.isMissingNode()) {
            return "merged";
        }
        return state;
    }

    private GithubPrDTO toDTO(GithubPullRequest pr) {
        String author = pr.getAuthorLogin() != null ? pr.getAuthorLogin() : pr.getAuthor();
        String url = pr.getGithubUrl() != null ? pr.getGithubUrl() : pr.getHtmlUrl();
        int prNum = pr.getGithubPrNumber() != null ? pr.getGithubPrNumber() : pr.getPrNumber();
        LocalDateTime mergedAt = pr.getGithubMergedAt() != null ? pr.getGithubMergedAt() : pr.getMergedAt();
        return GithubPrDTO.builder()
            .id(pr.getId())
            .integrationId(pr.getIntegration() != null ? pr.getIntegration().getId() : null)
            .githubPrNumber(prNum)
            .title(pr.getTitle())
            .body(pr.getBody())
            .state(pr.getState())
            .authorLogin(author)
            .headBranch(pr.getHeadBranch())
            .baseBranch(pr.getBaseBranch())
            .githubUrl(url)
            .linkedTaskId(pr.getLinkedTaskId() != null ? pr.getLinkedTaskId() : (pr.getTask() != null ? pr.getTask().getId() : null))
            .githubCreatedAt(pr.getGithubCreatedAt())
            .githubUpdatedAt(pr.getGithubUpdatedAt())
            .mergedAt(mergedAt)
            .build();
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank() || "null".equals(value)) return null;
        try { return OffsetDateTime.parse(value).toLocalDateTime(); } catch (Exception e) { return null; }
    }

    private String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() > max ? value.substring(0, max) : value;
    }
}

