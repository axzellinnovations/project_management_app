package com.planora.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;

/**
 * Low-level GitHub API HTTP client.
 *
 * Responsibilities:
 *  - Build authenticated request headers
 *  - Execute HTTP calls to the GitHub REST API
 *  - Return raw JsonNode — no business logic, no persistence
 *
 * Every method is token-agnostic: callers supply the token.
 * All errors are caught and return null/empty so callers degrade gracefully.
 */
@Component
public class GithubApiClient {

    private static final Logger log = LoggerFactory.getLogger(GithubApiClient.class);
    private static final String API = "https://api.github.com";
    private static final String ACCEPT_V3 = "application/vnd.github.v3+json";

    private final RestTemplate restTemplate = new RestTemplate();

    // ── Repository ────────────────────────────────────────────────────────────

    public JsonNode fetchUserRepositories(String token) {
        return get("/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator", token);
    }

    // ── Pull Requests ─────────────────────────────────────────────────────────

    public JsonNode fetchPullRequests(String token, String owner, String repo,
                                      String branch, int maxItems) {
        String path = "/repos/" + owner + "/" + repo
                + "/pulls?head=" + owner + ":" + branch
                + "&state=all&per_page=" + maxItems;
        return get(path, token);
    }

    public JsonNode fetchPrReviews(String token, String owner, String repo, int prNumber) {
        return get("/repos/" + owner + "/" + repo + "/pulls/" + prNumber + "/reviews", token);
    }

    public JsonNode fetchAllPullRequests(String token, String owner, String repo, int maxItems) {
        String path = "/repos/" + owner + "/" + repo
                + "/pulls?state=all&per_page=" + maxItems + "&sort=updated&direction=desc";
        return get(path, token);
    }

    // ── Commits ───────────────────────────────────────────────────────────────

    public JsonNode fetchCommits(String token, String owner, String repo,
                                 String branch, int maxItems) {
        return get("/repos/" + owner + "/" + repo
                + "/commits?sha=" + branch + "&per_page=" + maxItems, token);
    }

    // ── CI Status ─────────────────────────────────────────────────────────────

    public JsonNode fetchCheckRuns(String token, String owner, String repo, String sha) {
        return get("/repos/" + owner + "/" + repo + "/commits/" + sha + "/check-runs", token);
    }

    public JsonNode fetchCommitStatuses(String token, String owner, String repo, String sha) {
        return get("/repos/" + owner + "/" + repo + "/commits/" + sha + "/statuses", token);
    }

    // ── Issues ────────────────────────────────────────────────────────────────

    public JsonNode fetchIssues(String token, String owner, String repo,
                                String state, int maxItems) {
        // filter=all excludes pull requests from the issues endpoint response
        String path = "/repos/" + owner + "/" + repo
                + "/issues?state=" + state
                + "&per_page=" + maxItems
                + "&filter=all&sort=created&direction=desc";
        return get(path, token);
    }

    public JsonNode createIssue(String token, String owner, String repo,
                                String title, String body) {
        String url  = API + "/repos/" + owner + "/" + repo + "/issues";
        String json = buildIssuePayload(title, body);
        HttpEntity<String> entity = new HttpEntity<>(json, buildHeaders(token, true));
        try {
            ResponseEntity<JsonNode> res = restTemplate.exchange(
                    url, HttpMethod.POST, entity, JsonNode.class);
            return res.getBody();
        } catch (RestClientException e) {
            log.warn("GitHub createIssue failed for {}/{}: {}", owner, repo, e.getMessage());
            return null;
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private JsonNode get(String path, String token) {
        try {
            ResponseEntity<JsonNode> res = restTemplate.exchange(
                    API + path, HttpMethod.GET,
                    new HttpEntity<>(buildHeaders(token, false)), JsonNode.class);
            return res.getBody();
        } catch (RestClientException e) {
            log.debug("GitHub GET {} failed: {}", path, e.getMessage());
            return null;
        }
    }

    private HttpHeaders buildHeaders(String token, boolean withContentType) {
        HttpHeaders h = new HttpHeaders();
        h.set(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        h.set(HttpHeaders.ACCEPT, ACCEPT_V3);
        if (withContentType) {
            h.set(HttpHeaders.CONTENT_TYPE, "application/json");
        }
        return h;
    }

    private String buildIssuePayload(String title, String body) {
        String safeTitle = title == null ? "" : title.replace("\"", "\\\"").replace("\n", "\\n");
        String safeBody  = body  == null ? "" : body.replace("\"", "\\\"").replace("\n", "\\n");
        return "{\"title\":\"" + safeTitle + "\",\"body\":\"" + safeBody + "\"}";
    }
}
