package com.planora.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.repository.GithubIntegrationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GithubWebhookServiceTest {

    @Mock private GithubIntegrationRepository integrationRepository;
    @Mock private GithubPullRequestService pullRequestService;
    @Mock private GithubCommitService commitService;
    @Mock private GithubIssueService issueService;
    @Mock private ObjectMapper objectMapper;

    @InjectMocks private GithubWebhookService webhookService;

    @Test
    void handleEvent_dispatchesPullRequestForMatchingActiveIntegration() throws Exception {
        GithubIntegration integration = integration("planora/app");
        JsonNode root = new ObjectMapper().readTree("""
                {"action":"opened","repository":{"full_name":"planora/app"},
                 "pull_request":{"number":42,"title":"Improve tests"}}
                """);
        when(objectMapper.readTree(any(String.class))).thenReturn(root);
        when(integrationRepository.findByRepositoryFullNameIgnoreCaseAndActiveTrue("planora/app")).thenReturn(List.of(integration));

        webhookService.handleEvent("pull_request", "payload");

        ArgumentCaptor<JsonNode> payload = ArgumentCaptor.forClass(JsonNode.class);
        verify(pullRequestService).upsertPullRequest(org.mockito.ArgumentMatchers.eq(integration), payload.capture());
        assertEquals(42, payload.getValue().path("number").asInt());
        verify(commitService, never()).upsertCommit(any(), any());
        verify(issueService, never()).upsertIssue(any(), any());
    }

    @Test
    void handleEvent_wrapsEveryPushCommitBeforeUpsert() throws Exception {
        GithubIntegration integration = integration("planora/app");
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree("""
                {"repository":{"full_name":"planora/app"},"commits":[
                 {"id":"abc","message":"Fix \\\"bug\\\"","author":{"name":"Ada","email":"ada@example.com"},"timestamp":"2026-07-24T00:00:00Z","url":"https://example/abc"},
                 {"id":"def","message":"Second","author":{"name":"Lin","email":"lin@example.com"},"timestamp":"2026-07-24T01:00:00Z","url":"https://example/def"}]}
                """);
        when(objectMapper.readTree("payload")).thenReturn(root);
        when(objectMapper.readTree(org.mockito.ArgumentMatchers.startsWith("{\"sha\"")))
                .thenAnswer(invocation -> mapper.readTree(invocation.getArgument(0, String.class)));
        when(integrationRepository.findByRepositoryFullNameIgnoreCaseAndActiveTrue("planora/app")).thenReturn(List.of(integration));

        webhookService.handleEvent("push", "payload");

        ArgumentCaptor<JsonNode> commits = ArgumentCaptor.forClass(JsonNode.class);
        verify(commitService, org.mockito.Mockito.times(2)).upsertCommit(org.mockito.ArgumentMatchers.eq(integration), commits.capture());
        assertEquals("abc", commits.getAllValues().get(0).path("sha").asText());
        assertEquals("Fix \"bug\"", commits.getAllValues().get(0).path("commit").path("message").asText());
        assertEquals("def", commits.getAllValues().get(1).path("sha").asText());
    }

    @Test
    void handleEvent_dispatchesIssueOnlyWhenRepositoryIsIntegrated() throws Exception {
        JsonNode root = new ObjectMapper().readTree("""
                {"action":"closed","repository":{"full_name":"other/app"},"issue":{"number":7}}
                """);
        when(objectMapper.readTree(any(String.class))).thenReturn(root);
        when(integrationRepository.findByRepositoryFullNameIgnoreCaseAndActiveTrue("other/app")).thenReturn(List.of());

        webhookService.handleEvent("issues", "payload");

        verify(issueService, never()).upsertIssue(any(), any());
    }

    @Test
    void handleEvent_ignoresUnsupportedEventsWithoutRepositoryLookup() throws Exception {
        when(objectMapper.readTree(any(String.class))).thenReturn(new ObjectMapper().readTree("{}"));

        webhookService.handleEvent("release", "payload");

        verify(integrationRepository, never()).findByRepositoryFullNameIgnoreCaseAndActiveTrue(any());
    }

    private GithubIntegration integration(String repositoryFullName) {
        GithubIntegration integration = new GithubIntegration();
        integration.setRepositoryFullName(repositoryFullName);
        return integration;
    }
}
