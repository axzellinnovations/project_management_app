package com.planora.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import com.planora.backend.dto.GithubCollaboratorInviteRequestDTO;
import com.planora.backend.dto.GithubCollaboratorInviteResponseDTO;
import com.planora.backend.dto.GithubLinkRequestDTO;
import com.planora.backend.dto.ProjectGithubRepositoryDTO;
import com.planora.backend.exception.BadRequestException;
import com.planora.backend.exception.ConflictException;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.GithubAuthenticationException;
import com.planora.backend.exception.GithubIssueValidationException;
import com.planora.backend.exception.GithubRateLimitException;
import com.planora.backend.exception.GithubRepositoryNotFoundException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.Project;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.GithubIntegrationRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProjectGithubIntegrationService {
    private final GithubIntegrationRepository integrationRepository;
    private final GithubApiClient githubApiClient;
    private final GithubTokenService githubTokenService;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final GithubPullRequestService pullRequestService;
    private final GithubCommitService commitService;
    private final GithubIssueService issueService;

    @Transactional
    public ProjectGithubRepositoryDTO linkRepository(GithubLinkRequestDTO request, Long userId) {
        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + request.getProjectId()));
        requireOwnerOrAdmin(project, userId);

        String accessToken = githubTokenService.getToken(userId);
        if (accessToken == null || accessToken.isBlank()) {
            throw new GithubAuthenticationException("GitHub account is not connected");
        }

        try {
            githubApiClient.fetchRepository(request.getRepositoryFullName(), accessToken);
        } catch (GithubApiClient.GithubApiException e) {
            throw mapGithubRepositoryAccessException(e);
        }

        // Deactivate any other active integrations for this project so only one repository is active at a time
        List<GithubIntegration> currentActive = integrationRepository.findByProjectIdAndActiveTrue(request.getProjectId());
        for (GithubIntegration activeInt : currentActive) {
            if (!activeInt.getRepositoryFullName().equalsIgnoreCase(request.getRepositoryFullName())) {
                activeInt.setActive(false);
                integrationRepository.save(activeInt);
                log.info("Deactivated previous GitHub integration {} ({}) for project {}",
                        activeInt.getId(), activeInt.getRepositoryFullName(), request.getProjectId());
            }
        }

        Optional<GithubIntegration> existing = integrationRepository.findByProjectIdAndRepositoryFullName(
                request.getProjectId(), request.getRepositoryFullName());
        GithubIntegration integration;
        if (existing.isPresent()) {
            integration = existing.get();
            integration.setActive(true);
            integration.setEncryptedAccessToken(githubTokenService.encryptToken(accessToken));
            integration.setRepositoryUrl("https://github.com/" + request.getRepositoryFullName());
            integration = integrationRepository.save(integration);
            log.info("Repository '{}' already linked to project {}, reactivated and synced",
                    request.getRepositoryFullName(), request.getProjectId());
        } else {
            integration = new GithubIntegration();
            integration.setProject(project);
            integration.setRepositoryFullName(request.getRepositoryFullName());
            integration.setRepositoryUrl("https://github.com/" + request.getRepositoryFullName());
            integration.setEncryptedAccessToken(githubTokenService.encryptToken(accessToken));
            integration.setTokenType(GithubIntegration.TokenType.OAUTH);
            integration.setActive(true);
            integration = integrationRepository.save(integration);
            log.info("Linked GitHub repo '{}' to project {}", request.getRepositoryFullName(), request.getProjectId());
        }

        project.setGithubRepoFullName(request.getRepositoryFullName());
        projectRepository.save(project);

        triggerInitialSync(integration);
        return toDTO(integration);
    }

    private void triggerInitialSync(GithubIntegration integration) {
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                pullRequestService.syncPullRequests(integration);
            } catch (Exception e) {
                log.warn("Initial PR sync failed for {}: {}", integration.getRepositoryFullName(), e.getMessage());
            }
            try {
                commitService.syncCommits(integration);
            } catch (Exception e) {
                log.warn("Initial commit sync failed for {}: {}", integration.getRepositoryFullName(), e.getMessage());
            }
            try {
                issueService.syncIssues(integration);
            } catch (Exception e) {
                log.warn("Initial issue sync failed for {}: {}", integration.getRepositoryFullName(), e.getMessage());
            }
        });
    }

    @Transactional
    public void unlinkRepository(Long integrationId, Long projectId, Long userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + projectId));
        requireOwnerOrAdmin(project, userId);

        GithubIntegration integration = integrationRepository
                .findByIdAndProjectId(integrationId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Integration not found: " + integrationId));
        integrationRepository.delete(integration);

        Optional<GithubIntegration> remainingActive = integrationRepository.findByProjectIdAndActiveTrue(projectId)
                .stream().filter(i -> !i.getId().equals(integrationId)).findFirst();
        project.setGithubRepoFullName(remainingActive.map(GithubIntegration::getRepositoryFullName).orElse(null));
        projectRepository.save(project);

        log.info("Unlinked GitHub integration {} from project {}", integrationId, projectId);
    }

    @Transactional(readOnly = true)
    public List<ProjectGithubRepositoryDTO> getLinkedRepositories(Long projectId, Long userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + projectId));
        TeamMember member = requireProjectMember(project, userId);
        List<GithubIntegration> integrations = integrationRepository.findByProjectIdAndActiveTrue(projectId);

        if (member.getRole() == TeamRole.OWNER || member.getRole() == TeamRole.ADMIN) {
            return integrations.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        }

        User user = member.getUser();
        if (user.getGithubUsername() == null || user.getGithubUsername().isBlank()) {
            throw new GithubAuthenticationException("GitHub account is not connected");
        }
        String accessToken = githubTokenService.getToken(userId);
        if (accessToken == null || accessToken.isBlank()) {
            throw new GithubAuthenticationException("GitHub account is not connected");
        }

        return integrations.stream()
                .filter(integration -> hasRepositoryAccess(integration.getRepositoryFullName(), user.getGithubUsername(), accessToken))
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public GithubCollaboratorInviteResponseDTO inviteCollaborator(
            Long projectId,
            GithubCollaboratorInviteRequestDTO request,
            Long userId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found: " + projectId));
        requireOwnerOrAdmin(project, userId);

        GithubIntegration integration = integrationRepository.findByProjectIdAndActiveTrue(projectId).stream()
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("No active GitHub repository is linked to this project"));

        String accessToken = githubTokenService.getToken(userId);
        if (accessToken == null || accessToken.isBlank()) {
            throw new GithubAuthenticationException("GitHub account is not connected");
        }

        String identifier = normalizeIdentifier(request.getIdentifier());
        String permission = normalizePermission(request.getPermission());
        String githubUsername = resolveGithubUsername(project, identifier, accessToken);

        try {
            GithubApiClient.CollaboratorInviteResult result = githubApiClient.addRepositoryCollaborator(
                    integration.getRepositoryFullName(),
                    githubUsername,
                    permission,
                    accessToken);
            int githubStatus = result.statusCode();
            String status = githubStatus == 201 ? "INVITATION_CREATED" : "COLLABORATOR_UPDATED";
            String message = githubStatus == 201
                    ? "GitHub collaborator invitation created"
                    : "GitHub collaborator already has access or permission was updated";

            return GithubCollaboratorInviteResponseDTO.builder()
                    .projectId(projectId)
                    .integrationId(integration.getId())
                    .repositoryFullName(integration.getRepositoryFullName())
                    .githubUsername(githubUsername)
                    .permission(permission)
                    .githubStatus(githubStatus)
                    .status(status)
                    .message(message)
                    .build();
        } catch (GithubApiClient.GithubApiException e) {
            throw mapGithubInviteException(e);
        }
    }

    private ProjectGithubRepositoryDTO toDTO(GithubIntegration integration) {
        return ProjectGithubRepositoryDTO.builder()
                .integrationId(integration.getId())
                .projectId(integration.getProject().getId())
                .repositoryFullName(integration.getRepositoryFullName())
                .repositoryUrl(integration.getRepositoryUrl())
                .tokenType(integration.getTokenType().name())
                .active(integration.isActive())
                .build();
    }

    private TeamMember requireProjectMember(Project project, Long userId) {
        if (userId == null) {
            throw new GithubAuthenticationException("Authentication is required");
        }
        Long teamId = project.getTeam().getId();
        return teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new ForbiddenException("User is not a member of the project"));
    }

    private TeamMember requireOwnerOrAdmin(Project project, Long userId) {
        TeamMember member = requireProjectMember(project, userId);
        if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.ADMIN) {
            throw new ForbiddenException("Only project OWNER or ADMIN can manage GitHub repositories");
        }
        return member;
    }

    private boolean hasRepositoryAccess(String repoFullName, String githubUsername, String accessToken) {
        try {
            githubApiClient.getRepositoryPermission(repoFullName, githubUsername, accessToken);
            return true;
        } catch (GithubApiClient.GithubApiException e) {
            if (e.getStatusCode() == 404) {
                return false;
            }
            if (e.getStatusCode() == 401) {
                throw new GithubAuthenticationException("GitHub account is not connected");
            }
            if (e.getStatusCode() == 429) {
                throw new GithubRateLimitException("GitHub API rate limit exceeded. Please try again later.");
            }
            if (e.getStatusCode() == 403) {
                throw new ForbiddenException("GitHub token does not have permission to verify repository access");
            }
            throw e;
        }
    }

    private String resolveGithubUsername(Project project, String identifier, String accessToken) {
        if (identifier.contains("@")) {
            Long teamId = project.getTeam().getId();
            return teamMemberRepository.findByTeamId(teamId).stream()
                    .map(TeamMember::getUser)
                    .filter(user -> user != null && (
                            identifier.equalsIgnoreCase(user.getEmail())
                                    || (user.getGithubEmail() != null && identifier.equalsIgnoreCase(user.getGithubEmail()))))
                    .findFirst()
                    .map(User::getGithubUsername)
                    .filter(username -> username != null && !username.isBlank())
                    .orElseThrow(() -> new BadRequestException("GitHub username required for private-email accounts."));
        }

        try {
            JsonNode userNode = githubApiClient.fetchPublicUser(identifier, accessToken);
            String login = userNode == null ? null : userNode.path("login").asText(null);
            if (login == null || login.isBlank()) {
                throw new GithubRepositoryNotFoundException("GitHub user not found: " + identifier);
            }
            return login;
        } catch (GithubApiClient.GithubApiException e) {
            if (e.getStatusCode() == 404) {
                throw new GithubRepositoryNotFoundException("GitHub user not found: " + identifier);
            }
            if (e.getStatusCode() == 401) {
                throw new GithubAuthenticationException("GitHub account is not connected");
            }
            if (e.getStatusCode() == 429) {
                throw new GithubRateLimitException("GitHub API rate limit exceeded. Please try again later.");
            }
            throw e;
        }
    }

    private String normalizeIdentifier(String identifier) {
        String normalized = identifier == null ? "" : identifier.trim();
        if (normalized.isBlank()) {
            throw new BadRequestException("GitHub username or email is required");
        }
        return normalized;
    }

    private String normalizePermission(String permission) {
        if (permission == null || permission.isBlank()) {
            return "push";
        }
        String normalized = permission.trim().toLowerCase();
        if (!List.of("pull", "triage", "push", "maintain").contains(normalized)) {
            throw new GithubIssueValidationException("Permission must be pull, triage, push, or maintain");
        }
        return normalized;
    }

    private RuntimeException mapGithubInviteException(GithubApiClient.GithubApiException e) {
        return switch (e.getStatusCode()) {
            case 401 -> new GithubAuthenticationException("GitHub account is not connected");
            case 403 -> new ForbiddenException("GitHub rejected the collaborator invite. Check repository administration permission or organization policy.");
            case 404 -> new GithubRepositoryNotFoundException("GitHub repository or user was not found");
            case 422 -> new GithubIssueValidationException("GitHub rejected the collaborator invite. The user may already have incompatible access or invitation limits may have been reached.");
            case 429 -> new GithubRateLimitException("GitHub API rate limit exceeded. Please try again later.");
            default -> e;
        };
    }

    private RuntimeException mapGithubRepositoryAccessException(GithubApiClient.GithubApiException e) {
        return switch (e.getStatusCode()) {
            case 401 -> new GithubAuthenticationException("GitHub account is not connected");
            case 403 -> new ForbiddenException("GitHub token does not have permission to access this repository");
            case 404 -> new GithubRepositoryNotFoundException("GitHub repository not found or not accessible");
            case 422 -> new GithubIssueValidationException("GitHub rejected the repository request");
            case 429 -> new GithubRateLimitException("GitHub API rate limit exceeded. Please try again later.");
            default -> e;
        };
    }
}
