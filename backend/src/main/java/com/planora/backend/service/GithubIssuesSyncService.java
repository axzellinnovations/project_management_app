package com.planora.backend.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.planora.backend.dto.GithubIssueDTO;
import com.planora.backend.dto.GithubIssueCreateRequestDTO;
import com.planora.backend.dto.GithubCommentDTO;
import com.planora.backend.dto.GithubLabelDTO;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.GithubAuthenticationException;
import com.planora.backend.exception.GithubIssueValidationException;
import com.planora.backend.exception.GithubRateLimitException;
import com.planora.backend.exception.GithubRepositoryNotFoundException;

@Service
public class GithubIssuesSyncService {

    private final RestClient githubClient;

    @Autowired
    public GithubIssuesSyncService(
            RestClient.Builder restClientBuilder,
            @Value("${github.api-base-url:https://api.github.com}") String githubApiBaseUrl) {
        githubClient = restClientBuilder
                .baseUrl(githubApiBaseUrl)
                .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
                .defaultHeader("X-GitHub-Api-Version", "2022-11-28")
                .build();
    }

    /** Convenience constructor retained for isolated unit tests. */
    GithubIssuesSyncService(RestClient.Builder restClientBuilder) {
        this(restClientBuilder, "https://api.github.com");
    }

    /**
     * Fetches issues and pull-request issue entries exposed by GitHub's issues endpoint.
     */
    @Cacheable(cacheNames = "github-issues", key = "#repoFullName.toLowerCase()", sync = true)
    public List<GithubIssueDTO> syncIssues(String repoFullName, String accessToken) {
        String[] repositoryParts = repositoryParts(repoFullName);

        List<GithubIssueDTO> issues = githubClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/repos/{owner}/{repo}/issues")
                        .queryParam("state", "all")
                        .queryParam("per_page", 100)
                        .build(repositoryParts[0], repositoryParts[1]))
                .headers(headers -> headers.setBearerAuth(accessToken))
                .retrieve()
                .onStatus(status -> status.value() == 401, (request, response) -> {
                    throw new GithubAuthenticationException("Invalid GitHub access token");
                })
                .onStatus(status -> status.value() == 403, (request, response) -> {
                    throw new GithubRateLimitException("GitHub API rate limit exceeded");
                })
                .onStatus(status -> status.value() == 404, (request, response) -> {
                    throw new GithubRepositoryNotFoundException("GitHub repository not found");
                })
                .body(new ParameterizedTypeReference<List<GithubIssueDTO>>() {
                });

        if (issues == null) {
            return List.of();
        }

        return issues.stream()
                .filter(issue -> !issue.isPullRequest())
                .toList();
    }

    public List<GithubLabelDTO> syncLabels(String repoFullName, String accessToken) {
        String[] repositoryParts = repositoryParts(repoFullName);

        return githubClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/repos/{owner}/{repo}/labels")
                        .queryParam("per_page", 100)
                        .build(repositoryParts[0], repositoryParts[1]))
                .headers(headers -> headers.setBearerAuth(accessToken))
                .retrieve()
                .onStatus(status -> status.value() == 401, (request, response) -> {
                    throw new GithubAuthenticationException("Invalid GitHub access token");
                })
                .onStatus(status -> status.value() == 403, (request, response) -> {
                    throw new GithubRateLimitException("GitHub API rate limit exceeded");
                })
                .onStatus(status -> status.value() == 404, (request, response) -> {
                    throw new GithubRepositoryNotFoundException("GitHub repository not found");
                })
                .body(new ParameterizedTypeReference<List<GithubLabelDTO>>() {
                });
    }

    @Cacheable(
            cacheNames = "github-issue-comments",
            key = "#repoFullName.toLowerCase() + ':' + #issueNumber",
            sync = true)
    public List<GithubCommentDTO> fetchIssueComments(String repoFullName, int issueNumber, String accessToken) {
        String[] repositoryParts = repositoryParts(repoFullName);

        return githubClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/repos/{owner}/{repo}/issues/{issueNumber}/comments")
                        .build(repositoryParts[0], repositoryParts[1], issueNumber))
                .headers(headers -> headers.setBearerAuth(accessToken))
                .retrieve()
                .onStatus(status -> status.value() == 401, (request, response) -> {
                    throw new GithubAuthenticationException("Invalid GitHub access token");
                })
                .onStatus(status -> status.value() == 403, (request, response) -> {
                    throw new GithubRateLimitException("GitHub API rate limit exceeded");
                })
                .onStatus(status -> status.value() == 404, (request, response) -> {
                    throw new GithubRepositoryNotFoundException("GitHub issue or repository not found");
                })
                .body(new ParameterizedTypeReference<List<GithubCommentDTO>>() {
                });
    }

    @CacheEvict(cacheNames = "github-issues", key = "#request.repoFullName.toLowerCase()")
    public GithubIssueDTO createIssue(GithubIssueCreateRequestDTO request, String accessToken) {
        String[] repositoryParts = repositoryParts(request.getRepoFullName());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", request.getTitle());
        if (request.getBody() != null) {
            payload.put("body", request.getBody());
        }
        if (request.getLabels() != null) {
            payload.put("labels", request.getLabels());
        }
        if (request.getAssignees() != null) {
            payload.put("assignees", request.getAssignees());
        }

        return githubClient.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/repos/{owner}/{repo}/issues")
                        .build(repositoryParts[0], repositoryParts[1]))
                .headers(headers -> headers.setBearerAuth(accessToken))
                .body(payload)
                .retrieve()
                .onStatus(status -> status.value() == 401, (httpRequest, response) -> {
                    throw new GithubAuthenticationException("Invalid GitHub access token");
                })
                .onStatus(status -> status.value() == 403, (httpRequest, response) -> {
                    if ("0".equals(response.getHeaders().getFirst("X-RateLimit-Remaining"))) {
                        throw new GithubRateLimitException("GitHub API rate limit exceeded");
                    }
                    throw new ForbiddenException("GitHub token does not have permission to create issues");
                })
                .onStatus(status -> status.value() == 404, (httpRequest, response) -> {
                    throw new GithubRepositoryNotFoundException("GitHub repository not found");
                })
                .onStatus(status -> status.value() == 422, (httpRequest, response) -> {
                    throw new GithubIssueValidationException("GitHub rejected the issue data");
                })
                .body(GithubIssueDTO.class);
    }

    private String[] repositoryParts(String repoFullName) {
        String[] repositoryParts = repoFullName.split("/", 2);
        if (repositoryParts.length != 2
                || repositoryParts[0].isBlank()
                || repositoryParts[1].isBlank()) {
            throw new GithubRepositoryNotFoundException("GitHub repository not found");
        }
        return repositoryParts;
    }
}
