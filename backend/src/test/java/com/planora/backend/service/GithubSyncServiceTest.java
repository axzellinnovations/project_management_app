package com.planora.backend.service;

import com.planora.backend.model.GithubIntegration;
import com.planora.backend.repository.GithubCommitRepository;
import com.planora.backend.repository.GithubIntegrationRepository;
import com.planora.backend.repository.GithubIssueRepository;
import com.planora.backend.repository.GithubPullRequestRepository;
import com.planora.backend.service.GithubApiClient.GithubApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GithubSyncServiceTest {

    @Mock
    private GithubIntegrationRepository integrationRepository;
    @Mock
    private GithubPullRequestService pullRequestService;
    @Mock
    private GithubCommitService commitService;
    @Mock
    private GithubIssueService issueService;
    @Mock
    private GithubPullRequestRepository pullRequestRepository;
    @Mock
    private GithubCommitRepository commitRepository;
    @Mock
    private GithubIssueRepository issueRepository;
    @Mock
    private GithubTokenService githubTokenService;
    @Mock
    private ScheduledJobLockService scheduledJobLockService;

    @InjectMocks
    private GithubSyncService githubSyncService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(githubSyncService, "syncEnabled", true);
        when(scheduledJobLockService.tryAcquire(anyString(), any())).thenReturn(true);
    }

    @Test
    void scheduledSync_abortsOn401WithoutDeactivating() {
        GithubIntegration integration = new GithubIntegration();
        integration.setId(1L);
        integration.setRepositoryFullName("Suthankan1/Last-Web");
        integration.setActive(true);

        when(integrationRepository.findAllByActiveTrue()).thenReturn(List.of(integration));
        when(githubTokenService.hasValidToken(integration)).thenReturn(true);

        // Throw 401 on PR sync
        doThrow(new GithubApiException(401, "Unauthorized"))
                .when(pullRequestService).syncPullRequests(integration);

        githubSyncService.scheduledSync();

        assertTrue(integration.isActive());
        verifyNoInteractions(commitService);
        verifyNoInteractions(issueService);
    }

    @Test
    void scheduledSync_continuesOnGenericExceptionAndDoesNotDeactivate() {
        GithubIntegration integration = new GithubIntegration();
        integration.setId(1L);
        integration.setRepositoryFullName("Suthankan1/Last-Web");
        integration.setActive(true);

        when(integrationRepository.findAllByActiveTrue()).thenReturn(List.of(integration));
        when(githubTokenService.hasValidToken(integration)).thenReturn(true);

        // Throw generic exception on PR sync
        doThrow(new RuntimeException("Generic network error"))
                .when(pullRequestService).syncPullRequests(integration);

        githubSyncService.scheduledSync();

        assertTrue(integration.isActive());
        verify(integrationRepository, never()).save(integration);
        verify(commitService).syncCommits(integration);
        verify(issueService).syncIssues(integration);
    }

    @Test
    void scheduledSync_runsAllStepsSuccessfully() {
        GithubIntegration integration = new GithubIntegration();
        integration.setId(1L);
        integration.setRepositoryFullName("Suthankan1/Last-Web");
        integration.setActive(true);

        when(integrationRepository.findAllByActiveTrue()).thenReturn(List.of(integration));
        when(githubTokenService.hasValidToken(integration)).thenReturn(true);

        githubSyncService.scheduledSync();

        assertTrue(integration.isActive());
        verify(pullRequestService).syncPullRequests(integration);
        verify(commitService).syncCommits(integration);
        verify(issueService).syncIssues(integration);
        verify(integrationRepository, never()).save(any());
    }
}
