package com.planora.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.time.OffsetDateTime;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
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

class GithubIssuesSyncServiceTest {

    private MockRestServiceServer server;
    private GithubIssuesSyncService service;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        service = new GithubIssuesSyncService(builder);
    }

    @Test
    void syncIssues_fetchesAndMapsGithubIssues() {
        String response = """
                [{
                  "id": 12,
                  "number": 34,
                  "title": "Fix login",
                  "body": "Session expires early",
                  "state": "open",
                  "labels": [{"name": "bug", "color": "d73a4a"}],
                  "assignees": [{"login": "octocat"}, {"login": "hubot"}],
                  "created_at": "2026-05-01T10:15:30Z",
                  "updated_at": "2026-05-02T12:00:00Z",
                  "html_url": "https://github.com/planora/app/issues/34",
                  "comments": 2
                }]
                """;

        server.expect(requestTo("https://api.github.com/repos/planora/app/issues?state=all&per_page=100"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer github-token"))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));

        List<GithubIssueDTO> result = service.syncIssues("planora/app", "github-token");

        assertEquals(1, result.size());
        GithubIssueDTO issue = result.get(0);
        assertEquals(12L, issue.getId());
        assertEquals(34, issue.getNumber());
        assertEquals("Fix login", issue.getTitle());
        assertEquals("open", issue.getState());
        assertEquals("bug", issue.getLabels().get(0).getName());
        assertEquals(List.of("octocat", "hubot"), issue.getAssignees());
        assertEquals(OffsetDateTime.parse("2026-05-01T10:15:30Z"), issue.getCreatedAt());
        assertEquals("https://github.com/planora/app/issues/34", issue.getHtmlUrl());
        assertEquals(2, issue.getComments());
        server.verify();
    }

    @Test
    void syncIssues_filtersOutPullRequests() {
        String response = """
                [
                  {
                    "id": 12,
                    "number": 34,
                    "title": "Real issue",
                    "state": "open"
                  },
                  {
                    "id": 13,
                    "number": 35,
                    "title": "Pull Request entry",
                    "state": "open",
                    "pull_request": {
                      "url": "https://api.github.com/repos/planora/app/pulls/35",
                      "html_url": "https://github.com/planora/app/pull/35"
                    }
                  }
                ]
                """;

        server.expect(requestTo("https://api.github.com/repos/planora/app/issues?state=all&per_page=100"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer github-token"))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));

        List<GithubIssueDTO> result = service.syncIssues("planora/app", "github-token");

        assertEquals(1, result.size());
        assertEquals(34, result.get(0).getNumber());
        assertEquals("Real issue", result.get(0).getTitle());
        server.verify();
    }

    @Test
    void syncIssues_throwsAuthenticationExceptionForUnauthorizedToken() {
        server.expect(requestTo("https://api.github.com/repos/planora/app/issues?state=all&per_page=100"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        assertThrows(GithubAuthenticationException.class,
                () -> service.syncIssues("planora/app", "expired-token"));
        server.verify();
    }

    @Test
    void syncIssues_throwsRateLimitExceptionForForbiddenResponse() {
        server.expect(requestTo("https://api.github.com/repos/planora/app/issues?state=all&per_page=100"))
                .andRespond(withStatus(HttpStatus.FORBIDDEN));

        assertThrows(GithubRateLimitException.class,
                () -> service.syncIssues("planora/app", "github-token"));
        server.verify();
    }

    @Test
    void syncIssues_throwsNotFoundExceptionForMissingRepository() {
        server.expect(requestTo("https://api.github.com/repos/planora/missing/issues?state=all&per_page=100"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));

        assertThrows(GithubRepositoryNotFoundException.class,
                () -> service.syncIssues("planora/missing", "github-token"));
        server.verify();
    }

    @Test
    void syncLabels_fetchesRawRepositoryLabels() {
        String response = """
                [{"name": "bug", "color": "d73a4a"}, {"name": "feature", "color": "a2eeef"}]
                """;
        server.expect(requestTo("https://api.github.com/repos/planora/app/labels?per_page=100"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer github-token"))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));

        List<GithubLabelDTO> labels = service.syncLabels("planora/app", "github-token");

        assertEquals(2, labels.size());
        assertEquals("bug", labels.get(0).getName());
        assertEquals("d73a4a", labels.get(0).getColor());
        server.verify();
    }

    @Test
    void createIssue_postsPayloadAndMapsCreatedIssue() {
        GithubIssueCreateRequestDTO request = createRequest();
        String response = """
                {"id": 12, "number": 34, "title": "Fix login", "state": "open"}
                """;
        server.expect(requestTo("https://api.github.com/repos/planora/app/issues"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer github-token"))
                .andExpect(content().json("""
                        {"title":"Fix login","body":"Session expires early","labels":["bug"],"assignees":["octocat"]}
                        """))
                .andRespond(withStatus(HttpStatus.CREATED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(response));

        GithubIssueDTO createdIssue = service.createIssue(request, "github-token");

        assertEquals(34, createdIssue.getNumber());
        assertEquals("Fix login", createdIssue.getTitle());
        server.verify();
    }

    @Test
    void createIssue_throwsValidationExceptionForUnprocessableRequest() {
        server.expect(requestTo("https://api.github.com/repos/planora/app/issues"))
                .andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY));

        assertThrows(GithubIssueValidationException.class,
                () -> service.createIssue(createRequest(), "github-token"));
        server.verify();
    }

    @Test
    void createIssue_throwsForbiddenExceptionWhenTokenCannotWrite() {
        server.expect(requestTo("https://api.github.com/repos/planora/app/issues"))
                .andRespond(withStatus(HttpStatus.FORBIDDEN));

        assertThrows(ForbiddenException.class,
                () -> service.createIssue(createRequest(), "github-token"));
        server.verify();
    }

    @Test
    void createIssue_throwsRateLimitExceptionWhenGithubRateLimitIsExhausted() {
        server.expect(requestTo("https://api.github.com/repos/planora/app/issues"))
                .andRespond(withStatus(HttpStatus.FORBIDDEN)
                        .header("X-RateLimit-Remaining", "0"));

        assertThrows(GithubRateLimitException.class,
                () -> service.createIssue(createRequest(), "github-token"));
        server.verify();
    }

    @Test
    void createIssue_evictsRepositoryIssueCacheAfterSuccess() throws Exception {
        CacheEvict cacheEvict = GithubIssuesSyncService.class
                .getMethod("createIssue", GithubIssueCreateRequestDTO.class, String.class)
                .getAnnotation(CacheEvict.class);

        assertEquals("github-issues", cacheEvict.cacheNames()[0]);
        assertEquals("#request.repoFullName.toLowerCase()", cacheEvict.key());
    }

    @Test
    void fetchIssueComments_fetchesAndMapsGithubComments() {
        String response = """
                [{
                  "id": 72,
                  "body": "This is fixed now.",
                  "user": {"login": "octocat", "avatar_url": "https://avatars.example/octocat"},
                  "created_at": "2026-05-24T10:15:30Z"
                }]
                """;
        server.expect(requestTo("https://api.github.com/repos/planora/app/issues/34/comments"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer github-token"))
                .andRespond(withSuccess(response, MediaType.APPLICATION_JSON));

        List<GithubCommentDTO> comments = service.fetchIssueComments("planora/app", 34, "github-token");

        assertEquals(1, comments.size());
        assertEquals(72L, comments.get(0).getId());
        assertEquals("This is fixed now.", comments.get(0).getBody());
        assertEquals("octocat", comments.get(0).getUserLogin());
        assertEquals("https://avatars.example/octocat", comments.get(0).getUserAvatarUrl());
        assertEquals(Instant.parse("2026-05-24T10:15:30Z"), comments.get(0).getCreatedAt());
        server.verify();
    }

    @Test
    void fetchIssueComments_throwsNotFoundForMissingIssue() {
        server.expect(requestTo("https://api.github.com/repos/planora/app/issues/34/comments"))
                .andRespond(withStatus(HttpStatus.NOT_FOUND));

        assertThrows(GithubRepositoryNotFoundException.class,
                () -> service.fetchIssueComments("planora/app", 34, "github-token"));
        server.verify();
    }

    @Test
    void fetchIssueComments_usesDedicatedRepositoryIssueCache() throws Exception {
        Cacheable cacheable = GithubIssuesSyncService.class
                .getMethod("fetchIssueComments", String.class, int.class, String.class)
                .getAnnotation(Cacheable.class);

        assertEquals("github-issue-comments", cacheable.cacheNames()[0]);
        assertEquals("#repoFullName.toLowerCase() + ':' + #issueNumber", cacheable.key());
    }

    private GithubIssueCreateRequestDTO createRequest() {
        GithubIssueCreateRequestDTO request = new GithubIssueCreateRequestDTO();
        request.setRepoFullName("planora/app");
        request.setTitle("Fix login");
        request.setBody("Session expires early");
        request.setLabels(List.of("bug"));
        request.setAssignees(List.of("octocat"));
        return request;
    }
}
