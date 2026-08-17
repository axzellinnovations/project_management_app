package com.planora.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Centralizes ALL GitHub REST API communication.
 * No business logic here — only HTTP calls, auth headers, and error handling.
 */
@Slf4j
@Service
public class GithubApiClient {

    private static final int MAX_PER_PAGE = 100;

    @Value("${github.api-base-url:https://api.github.com}")
    private String githubApiBaseUrl = "https://api.github.com";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public GithubApiClient(HttpClient httpClient, ObjectMapper objectMapper) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    public List<JsonNode> fetchPullRequests(String repoFullName, String token, String state, int page, int perPage) {
        String url = githubApiBaseUrl + "/repos/" + repoFullName + "/pulls"
            + "?state=" + state
            + "&per_page=" + Math.min(perPage, MAX_PER_PAGE)
            + "&page=" + page;
        try {
            return getList(url, token);
        } catch (GithubApiException e) {
            if (e.getStatusCode() == 404 || e.getStatusCode() == 409) {
                log.info("Repository '{}' returned status {} from pulls API", repoFullName, e.getStatusCode());
                return List.of();
            }
            throw e;
        }
    }

    public List<JsonNode> fetchCommits(String repoFullName, String token, int page, int perPage) {
        String url = githubApiBaseUrl + "/repos/" + repoFullName + "/commits"
            + "?per_page=" + Math.min(perPage, MAX_PER_PAGE)
            + "&page=" + page;
        try {
            return getList(url, token);
        } catch (GithubApiException e) {
            if (e.getStatusCode() == 409 || e.getStatusCode() == 404) {
                log.info("Repository '{}' returned status {} (empty or uninitialized) from commits API", repoFullName, e.getStatusCode());
                return List.of();
            }
            throw e;
        }
    }

    public List<JsonNode> fetchIssues(String repoFullName, String token, String state, int page, int perPage) {
        // GitHub issues endpoint returns both issues and PRs — callers must filter out PRs
        String url = githubApiBaseUrl + "/repos/" + repoFullName + "/issues"
            + "?state=" + state
            + "&per_page=" + Math.min(perPage, MAX_PER_PAGE)
            + "&page=" + page;
        try {
            return getList(url, token);
        } catch (GithubApiException e) {
            if (e.getStatusCode() == 404 || e.getStatusCode() == 409) {
                log.info("Repository '{}' returned status {} from issues API", repoFullName, e.getStatusCode());
                return List.of();
            }
            throw e;
        }
    }

    public JsonNode fetchRepository(String repoFullName, String token) {
        return get(githubApiBaseUrl + "/repos/" + repoFullName, token);
    }

    public JsonNode fetchPublicUser(String username, String token) {
        return get(githubApiBaseUrl + "/users/" + encodePathSegment(username), token);
    }

    public JsonNode getRepositoryPermission(String repoFullName, String username, String token) {
        String url = githubApiBaseUrl + "/repos/" + repoFullName
            + "/collaborators/" + encodePathSegment(username) + "/permission";
        return get(url, token);
    }

    public CollaboratorInviteResult addRepositoryCollaborator(
            String repoFullName,
            String username,
            String permission,
            String token) {
        try {
            String json = objectMapper.writeValueAsString(Map.of("permission", permission));
            String url = githubApiBaseUrl + "/repos/" + repoFullName
                + "/collaborators/" + encodePathSegment(username);
            HttpRequest request = buildRequest(url, token)
                .PUT(HttpRequest.BodyPublishers.ofString(json))
                .header("Content-Type", "application/json")
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            validateResponse(url, response);
            JsonNode body = response.body() == null || response.body().isBlank()
                ? objectMapper.createObjectNode()
                : objectMapper.readTree(response.body());
            return new CollaboratorInviteResult(response.statusCode(), body);
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GithubApiException("GitHub collaborator invite failed for: " + repoFullName, e);
        }
    }

    public List<JsonNode> fetchUserRepositories(String token, int page) {
        String url = githubApiBaseUrl + "/user/repos?per_page=30&page=" + page + "&sort=updated";
        return getList(url, token);
    }

    public JsonNode createIssue(String repoFullName, String token, String title, String body, List<String> labels) {
        try {
            Map<String, Object> payload = Map.of(
                "title", title,
                "body", body != null ? body : "",
                "labels", labels != null ? labels : List.of()
            );
            String json = objectMapper.writeValueAsString(payload);
            return post(githubApiBaseUrl + "/repos/" + repoFullName + "/issues", token, json);
        } catch (IOException e) {
            throw new GithubApiException("Failed to serialize create-issue payload", e);
        }
    }

    // ── Internal HTTP helpers ────────────────────────────────────────────────

    private JsonNode get(String url, String token) {
        try {
            HttpRequest request = buildRequest(url, token).GET().build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            validateResponse(url, response);
            return objectMapper.readTree(response.body());
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GithubApiException("GitHub GET failed: " + url, e);
        }
    }

    private List<JsonNode> getList(String url, String token) {
        try {
            HttpRequest request = buildRequest(url, token).GET().build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            validateResponse(url, response);
            return objectMapper.readValue(response.body(), new TypeReference<>() {});
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GithubApiException("GitHub GET-list failed: " + url, e);
        }
    }

    private JsonNode post(String url, String token, String body) {
        try {
            HttpRequest request = buildRequest(url, token)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .header("Content-Type", "application/json")
                .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            validateResponse(url, response);
            return objectMapper.readTree(response.body());
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GithubApiException("GitHub POST failed: " + url, e);
        }
    }

    private HttpRequest.Builder buildRequest(String url, String token) {
        return HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .timeout(Duration.ofSeconds(10));
    }

    private String encodePathSegment(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private void validateResponse(String url, HttpResponse<String> response) {
        int status = response.statusCode();
        if (status == 401) {
            throw new GithubApiException(401, "GitHub API unauthorized — check token for: " + url);
        }
        if (status == 403) {
            String remaining = response.headers().firstValue("X-RateLimit-Remaining").orElse("?");
            if ("0".equals(remaining)) {
                throw new GithubApiException(429, "GitHub API rate limit exceeded for: " + url);
            }
            throw new GithubApiException(403, "GitHub API forbidden for: " + url);
        }
        if (status == 404) {
            throw new GithubApiException(404, "GitHub resource not found: " + url);
        }
        if (status == 422) {
            throw new GithubApiException(422, "GitHub validation failed for: " + url
                + " — " + response.body());
        }
        if (status >= 400) {
            throw new GithubApiException(status, "GitHub API error " + status + " for: " + url
                + " — " + response.body());
        }
    }

    public record CollaboratorInviteResult(int statusCode, JsonNode body) {
    }

    public static class GithubApiException extends RuntimeException {
        private final int statusCode;

        public GithubApiException(String message) {
            this(0, message);
        }

        public GithubApiException(int statusCode, String message) {
            super(message);
            this.statusCode = statusCode;
        }

        public GithubApiException(String message, Throwable cause) {
            super(message, cause);
            this.statusCode = 0;
        }

        public int getStatusCode() {
            return statusCode;
        }
    }
}
