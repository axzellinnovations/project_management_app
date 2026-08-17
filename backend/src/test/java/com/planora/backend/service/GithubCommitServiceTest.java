package com.planora.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.GithubCommitDTO;
import com.planora.backend.model.GithubCommit;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.repository.GithubCommitRepository;
import com.planora.backend.repository.GithubIntegrationRepository;
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
class GithubCommitServiceTest {

    @Mock
    private GithubApiClient githubApiClient;

    @Mock
    private GithubTokenService githubTokenService;

    @Mock
    private GithubIntegrationRepository integrationRepository;

    @Mock
    private GithubCommitRepository commitRepository;

    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private GithubCommitService commitService;

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
    void upsertCommit_setsAllFieldsAndResolvesTaskByProjectTaskNumber() throws Exception {
        String json = """
            {
              "sha": "a1b2c3d4e5f6789012345678901234567890abcd",
              "commit": {
                "message": "feat(PLAN-42): add responsive navigation bar",
                "author": {
                  "name": "John Doe",
                  "email": "john@example.com",
                  "date": "2026-08-16T12:00:00Z"
                }
              },
              "html_url": "https://github.com/testowner/testrepo/commit/a1b2c3d4e5f6789012345678901234567890abcd",
              "author": {
                "login": "johndoe",
                "avatar_url": "https://avatars.githubusercontent.com/u/123"
              }
            }
            """;
        JsonNode node = objectMapper.readTree(json);

        Task mockTask = new Task();
        mockTask.setId(99L);
        mockTask.setProjectTaskNumber(42L);
        mockTask.setProject(project);

        when(commitRepository.findByIntegrationIdAndSha(100L, "a1b2c3d4e5f6789012345678901234567890abcd"))
                .thenReturn(Optional.empty());
        when(taskRepository.findByProjectIdAndProjectTaskNumber(16L, 42L))
                .thenReturn(Optional.of(mockTask));

        commitService.upsertCommit(integration, node);

        ArgumentCaptor<GithubCommit> captor = ArgumentCaptor.forClass(GithubCommit.class);
        verify(commitRepository).save(captor.capture());

        GithubCommit saved = captor.getValue();
        assertEquals("a1b2c3d4e5f6789012345678901234567890abcd", saved.getSha());
        assertEquals("feat(PLAN-42): add responsive navigation bar", saved.getMessage());
        assertEquals("John Doe", saved.getAuthorName());
        assertEquals("johndoe", saved.getAuthor());
        assertEquals("john@example.com", saved.getAuthorEmail());
        assertEquals("https://github.com/testowner/testrepo/commit/a1b2c3d4e5f6789012345678901234567890abcd", saved.getCommitUrl());
        assertEquals("https://github.com/testowner/testrepo/commit/a1b2c3d4e5f6789012345678901234567890abcd", saved.getHtmlUrl());
        assertEquals("2026-08-16T12:00:00Z", saved.getCommittedAt());
        assertNotNull(saved.getAuthoredAt());
        assertEquals(99L, saved.getLinkedTaskId());
        assertEquals(mockTask, saved.getTask());
    }

    @Test
    void getCommits_triggersProactiveSyncWhenEmpty() throws Exception {
        when(integrationRepository.findByProjectIdAndActiveTrue(16L))
                .thenReturn(List.of(integration));
        when(commitRepository.countByIntegrationId(100L))
                .thenReturn(0L);
        when(githubTokenService.hasValidToken(integration)).thenReturn(true);
        when(githubTokenService.resolveToken(integration)).thenReturn("gh-token");

        String json = """
            [
              {
                "sha": "11223344556677889900aabbccddeeff00112233",
                "commit": {
                  "message": "initial commit",
                  "author": { "name": "Author", "email": "a@b.com", "date": "2026-08-16T10:00:00Z" }
                },
                "html_url": "https://github.com/test/commit/112233"
              }
            ]
            """;
        List<JsonNode> commitNodes = List.of(objectMapper.readTree(json).get(0));
        when(githubApiClient.fetchCommits("testowner/testrepo", "gh-token", 1, 100))
                .thenReturn(commitNodes);

        GithubCommit commitEntity = new GithubCommit();
        commitEntity.setId(1L);
        commitEntity.setIntegration(integration);
        commitEntity.setSha("11223344556677889900aabbccddeeff00112233");
        commitEntity.setMessage("initial commit");
        commitEntity.setAuthorName("Author");

        when(commitRepository.findByIntegrationIdIn(eq(List.of(100L)), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(commitEntity)));

        Page<GithubCommitDTO> page = commitService.getCommits(16L, 0, 20);

        assertEquals(1, page.getTotalElements());
        assertEquals("initial commit", page.getContent().get(0).getMessage());
        verify(githubApiClient).fetchCommits("testowner/testrepo", "gh-token", 1, 100);
    }

    @Test
    void resolveTaskRef_handlesExceptionFromProxyGracefully() {
        Project mockProject = mock(Project.class);
        when(mockProject.getProjectKey()).thenThrow(new org.hibernate.LazyInitializationException("no session"));

        Task task = commitService.resolveTaskRef(mockProject, "feat: PLAN-123");
        assertNull(task);
    }

    @Test
    void resolveTaskRef_returnsNullForNullProjectOrEmptyText() {
        assertNull(commitService.resolveTaskRef(null, "feat: PLAN-123"));
        assertNull(commitService.resolveTaskRef(project, ""));
        assertNull(commitService.resolveTaskRef(project, null));
    }
}
