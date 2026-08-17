package com.planora.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.GithubPrDTO;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.GithubPullRequest;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.repository.GithubIntegrationRepository;
import com.planora.backend.repository.GithubPullRequestRepository;
import com.planora.backend.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GithubPullRequestServiceTest {

    @Mock
    private GithubApiClient githubApiClient;

    @Mock
    private GithubTokenService githubTokenService;

    @Mock
    private GithubIntegrationRepository integrationRepository;

    @Mock
    private GithubPullRequestRepository pullRequestRepository;

    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private GithubPullRequestService pullRequestService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private GithubIntegration integration;
    private Project project;

    @BeforeEach
    void setUp() {
        project = new Project();
        project.setId(16L);
        project.setProjectKey("PLAN");

        integration = new GithubIntegration();
        integration.setId(100L);
        integration.setProject(project);
        integration.setRepositoryFullName("testowner/testrepo");
        integration.setActive(true);
    }

    @Test
    void upsertPullRequest_setsAllFieldsAndResolvesTask() throws Exception {
        String json = """
            {
              "number": 15,
              "title": "Fix bug in payment flow (#5)",
              "body": "Resolves issue with stripe checkout",
              "state": "open",
              "user": {
                "login": "octocat"
              },
              "head": {
                "ref": "fix/payment",
                "sha": "abcdef123456"
              },
              "base": {
                "ref": "main"
              },
              "html_url": "https://github.com/testowner/testrepo/pull/15",
              "created_at": "2026-08-16T12:00:00Z",
              "updated_at": "2026-08-16T12:30:00Z",
              "merged_at": null
            }
            """;
        JsonNode node = objectMapper.readTree(json);

        Task mockTask = new Task();
        mockTask.setId(105L);
        mockTask.setProjectTaskNumber(5L);
        mockTask.setProject(project);

        when(pullRequestRepository.findByIntegrationIdAndGithubPrNumber(100L, 15))
                .thenReturn(Optional.empty());
        when(taskRepository.findByProjectIdAndProjectTaskNumber(16L, 5L))
                .thenReturn(Optional.of(mockTask));

        pullRequestService.upsertPullRequest(integration, node);

        ArgumentCaptor<GithubPullRequest> captor = ArgumentCaptor.forClass(GithubPullRequest.class);
        verify(pullRequestRepository).save(captor.capture());

        GithubPullRequest saved = captor.getValue();
        assertEquals(15, saved.getGithubPrNumber());
        assertEquals(15, saved.getPrNumber());
        assertEquals("Fix bug in payment flow (#5)", saved.getTitle());
        assertEquals("open", saved.getState());
        assertEquals("octocat", saved.getAuthorLogin());
        assertEquals("octocat", saved.getAuthor());
        assertEquals("fix/payment", saved.getHeadBranch());
        assertEquals("main", saved.getBaseBranch());
        assertEquals("https://github.com/testowner/testrepo/pull/15", saved.getGithubUrl());
        assertEquals("https://github.com/testowner/testrepo/pull/15", saved.getHtmlUrl());
        assertEquals(105L, saved.getLinkedTaskId());
        assertEquals(mockTask, saved.getTask());
    }

    @Test
    void getPullRequests_triggersProactiveSyncWhenEmpty() throws Exception {
        when(integrationRepository.findByProjectIdAndActiveTrue(16L))
                .thenReturn(List.of(integration));
        when(pullRequestRepository.countByIntegrationId(100L))
                .thenReturn(0L);
        when(githubTokenService.hasValidToken(integration)).thenReturn(true);
        when(githubTokenService.resolveToken(integration)).thenReturn("gh-token");

        String json = """
            [
              {
                "number": 1,
                "title": "PR 1",
                "state": "open",
                "user": { "login": "user1" },
                "head": { "ref": "feat-1", "sha": "123" },
                "base": { "ref": "main" },
                "html_url": "https://github.com/test/pull/1",
                "created_at": "2026-08-16T10:00:00Z"
              }
            ]
            """;
        List<JsonNode> prNodes = List.of(objectMapper.readTree(json).get(0));
        when(githubApiClient.fetchPullRequests("testowner/testrepo", "gh-token", "all", 1, 100))
                .thenReturn(prNodes);

        GithubPullRequest prEntity = new GithubPullRequest();
        prEntity.setId(1L);
        prEntity.setIntegration(integration);
        prEntity.setGithubPrNumber(1);
        prEntity.setTitle("PR 1");
        prEntity.setState("open");

        when(pullRequestRepository.findByIntegrationIdIn(eq(List.of(100L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(prEntity)));

        Page<GithubPrDTO> page = pullRequestService.getPullRequests(16L, "all", 0, 20);

        assertEquals(1, page.getTotalElements());
        assertEquals("PR 1", page.getContent().get(0).getTitle());
        verify(githubApiClient).fetchPullRequests("testowner/testrepo", "gh-token", "all", 1, 100);
    }

    @Test
    void resolveTaskRef_handlesExceptionFromProxyGracefully() {
        Project mockProject = mock(Project.class);
        when(mockProject.getProjectKey()).thenThrow(new org.hibernate.LazyInitializationException("no session"));

        Task task = pullRequestService.resolveTaskRef(mockProject, "fix: #123");
        assertNull(task);
    }

    @Test
    void resolveTaskRef_returnsNullForNullProjectOrEmptyText() {
        assertNull(pullRequestService.resolveTaskRef(null, "fix: #123"));
        assertNull(pullRequestService.resolveTaskRef(project, ""));
        assertNull(pullRequestService.resolveTaskRef(project, null));
    }
}
