package com.planora.backend.service;

import com.planora.backend.model.GithubIntegration;
import com.planora.backend.repository.GithubIntegrationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Manages GitHub tokens stored in the github_integrations table.
 *
 * Tokens are stored server-side only — the frontend never receives or sends them.
 * All GitHub API calls route through GithubApiClient using tokens fetched here.
 */
@Service
@Transactional
public class GithubTokenService {

    @Autowired
    private GithubIntegrationRepository integrationRepository;

    @Transactional(readOnly = true)
    public Optional<String> getToken(Long projectId) {
        return integrationRepository.findActiveByProjectId(projectId)
                .map(GithubIntegration::getGithubToken)
                .filter(t -> t != null && !t.isBlank());
    }

    @Transactional(readOnly = true)
    public Optional<GithubIntegration> getIntegration(Long projectId) {
        return integrationRepository.findActiveByProjectId(projectId);
    }

    public GithubIntegration saveIntegration(Long projectId,
                                              String repoFullName,
                                              String token,
                                              Long connectedByUserId) {
        // Deactivate any existing integration for this project before saving a new one.
        integrationRepository.deactivateByProjectId(projectId);

        String[] parts = repoFullName.split("/", 2);
        String owner    = parts.length == 2 ? parts[0] : null;
        String repoName = parts.length == 2 ? parts[1] : repoFullName;

        GithubIntegration integration = new GithubIntegration();
        integration.setProjectId(projectId);
        integration.setRepoFullName(repoFullName);
        integration.setOwner(owner);
        integration.setRepoName(repoName);
        integration.setGithubToken(token);
        integration.setConnectedByUserId(connectedByUserId);
        integration.setConnectedAt(LocalDateTime.now());
        integration.setActive(true);

        return integrationRepository.save(integration);
    }

    public void deactivate(Long projectId) {
        integrationRepository.deactivateByProjectId(projectId);
    }

    @Transactional(readOnly = true)
    public boolean isConnected(Long projectId) {
        return integrationRepository.findActiveByProjectId(projectId).isPresent();
    }
}
