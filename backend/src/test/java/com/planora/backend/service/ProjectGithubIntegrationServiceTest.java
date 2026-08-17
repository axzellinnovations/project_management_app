package com.planora.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.GithubCollaboratorInviteRequestDTO;
import com.planora.backend.dto.GithubCollaboratorInviteResponseDTO;
import com.planora.backend.dto.GithubLinkRequestDTO;
import com.planora.backend.exception.BadRequestException;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.GithubAuthenticationException;
import com.planora.backend.exception.GithubIssueValidationException;
import com.planora.backend.exception.GithubRateLimitException;
import com.planora.backend.exception.GithubRepositoryNotFoundException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.GithubIntegrationRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectGithubIntegrationServiceTest {

    @Mock
    private GithubIntegrationRepository integrationRepository;

    @Mock
    private GithubApiClient githubApiClient;

    @Mock
    private GithubTokenService githubTokenService;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private GithubPullRequestService pullRequestService;

    @Mock
    private GithubCommitService commitService;

    @Mock
    private GithubIssueService issueService;

    @InjectMocks
    private ProjectGithubIntegrationService service;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void linkRepository_allowsOwner() {
        Project project = project();
        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.OWNER, 1L, "owner")));
        when(githubTokenService.getToken(1L)).thenReturn("token");
        when(integrationRepository.save(any(GithubIntegration.class))).thenAnswer(invocation -> {
            GithubIntegration integration = invocation.getArgument(0);
            integration.setId(42L);
            return integration;
        });

        GithubLinkRequestDTO request = new GithubLinkRequestDTO();
        request.setProjectId(7L);
        request.setRepositoryFullName("planora/web");

        assertEquals("planora/web", service.linkRepository(request, 1L).getRepositoryFullName());
        verify(githubApiClient).fetchRepository("planora/web", "token");
        verify(pullRequestService, timeout(2000)).syncPullRequests(any(GithubIntegration.class));
        verify(commitService, timeout(2000)).syncCommits(any(GithubIntegration.class));
        verify(issueService, timeout(2000)).syncIssues(any(GithubIntegration.class));
    }

    @Test
    void linkRepository_rejectsMember() {
        Project project = project();
        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 2L)).thenReturn(Optional.of(member(TeamRole.MEMBER, 2L, "member")));

        GithubLinkRequestDTO request = new GithubLinkRequestDTO();
        request.setProjectId(7L);
        request.setRepositoryFullName("planora/web");

        assertThrows(ForbiddenException.class, () -> service.linkRepository(request, 2L));
        verify(integrationRepository, never()).save(any());
    }

    @Test
    void getLinkedRepositories_returnsReposForCollaboratingMember() {
        Project project = project();
        GithubIntegration integration = integration(project);
        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 2L)).thenReturn(Optional.of(member(TeamRole.MEMBER, 2L, "octo")));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration));
        when(githubTokenService.getToken(2L)).thenReturn("member-token");
        when(githubApiClient.getRepositoryPermission("planora/web", "octo", "member-token"))
                .thenReturn(objectMapper.createObjectNode().put("permission", "push"));

        assertEquals(1, service.getLinkedRepositories(7L, 2L).size());
    }

    @Test
    void getLinkedRepositories_requiresGithubConnectionForMember() {
        Project project = project();
        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 2L)).thenReturn(Optional.of(member(TeamRole.MEMBER, 2L, null)));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration(project)));

        assertThrows(GithubAuthenticationException.class, () -> service.getLinkedRepositories(7L, 2L));
    }

    @Test
    void getLinkedRepositories_hidesReposWhenMemberIsNotGithubCollaborator() {
        Project project = project();
        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 2L)).thenReturn(Optional.of(member(TeamRole.MEMBER, 2L, "octo")));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration(project)));
        when(githubTokenService.getToken(2L)).thenReturn("member-token");
        when(githubApiClient.getRepositoryPermission("planora/web", "octo", "member-token"))
                .thenThrow(new GithubApiClient.GithubApiException(404, "not collaborator"));

        assertEquals(0, service.getLinkedRepositories(7L, 2L).size());
    }

    @Test
    void inviteCollaborator_succeedsByUsername() {
        Project project = project();
        GithubIntegration integration = integration(project);
        GithubCollaboratorInviteRequestDTO request = new GithubCollaboratorInviteRequestDTO();
        request.setIdentifier("octocat");
        request.setPermission("triage");

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.ADMIN, 1L, "admin")));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration));
        when(githubTokenService.getToken(1L)).thenReturn("admin-token");
        when(githubApiClient.fetchPublicUser("octocat", "admin-token"))
                .thenReturn(objectMapper.createObjectNode().put("login", "octocat"));
        when(githubApiClient.addRepositoryCollaborator("planora/web", "octocat", "triage", "admin-token"))
                .thenReturn(new GithubApiClient.CollaboratorInviteResult(201, objectMapper.createObjectNode()));

        GithubCollaboratorInviteResponseDTO response = service.inviteCollaborator(7L, request, 1L);

        assertEquals("octocat", response.getGithubUsername());
        assertEquals(201, response.getGithubStatus());
        assertEquals("INVITATION_CREATED", response.getStatus());
    }

    @Test
    void inviteCollaborator_returnsUpdatedWhenGithubReportsExistingCollaborator() {
        Project project = project();
        GithubCollaboratorInviteRequestDTO request = new GithubCollaboratorInviteRequestDTO();
        request.setIdentifier("octocat");
        request.setPermission("maintain");

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.OWNER, 1L, "owner")));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration(project)));
        when(githubTokenService.getToken(1L)).thenReturn("owner-token");
        when(githubApiClient.fetchPublicUser("octocat", "owner-token"))
                .thenReturn(objectMapper.createObjectNode().put("login", "octocat"));
        when(githubApiClient.addRepositoryCollaborator("planora/web", "octocat", "maintain", "owner-token"))
                .thenReturn(new GithubApiClient.CollaboratorInviteResult(204, objectMapper.createObjectNode()));

        GithubCollaboratorInviteResponseDTO response = service.inviteCollaborator(7L, request, 1L);

        assertEquals(204, response.getGithubStatus());
        assertEquals("COLLABORATOR_UPDATED", response.getStatus());
        assertEquals("GitHub collaborator already has access or permission was updated", response.getMessage());
    }

    @Test
    void inviteCollaborator_rejectsMemberRole() {
        Project project = project();
        GithubCollaboratorInviteRequestDTO request = new GithubCollaboratorInviteRequestDTO();
        request.setIdentifier("octocat");

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 2L)).thenReturn(Optional.of(member(TeamRole.MEMBER, 2L, "member")));

        assertThrows(ForbiddenException.class, () -> service.inviteCollaborator(7L, request, 2L));
        verify(githubApiClient, never()).addRepositoryCollaborator(any(), any(), any(), any());
    }

    @Test
    void inviteCollaborator_requiresGithubToken() {
        Project project = project();
        GithubCollaboratorInviteRequestDTO request = new GithubCollaboratorInviteRequestDTO();
        request.setIdentifier("octocat");

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.ADMIN, 1L, "admin")));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration(project)));
        when(githubTokenService.getToken(1L)).thenReturn(null);

        assertThrows(GithubAuthenticationException.class, () -> service.inviteCollaborator(7L, request, 1L));
        verify(githubApiClient, never()).addRepositoryCollaborator(any(), any(), any(), any());
    }

    @Test
    void inviteCollaborator_requiresActiveLinkedRepo() {
        Project project = project();
        GithubCollaboratorInviteRequestDTO request = new GithubCollaboratorInviteRequestDTO();
        request.setIdentifier("octocat");

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.ADMIN, 1L, "admin")));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of());

        assertThrows(ResourceNotFoundException.class, () -> service.inviteCollaborator(7L, request, 1L));
        verify(githubApiClient, never()).addRepositoryCollaborator(any(), any(), any(), any());
    }

    @Test
    void inviteCollaborator_resolvesPlanoraEmailToGithubUsername() {
        Project project = project();
        User invitee = new User();
        invitee.setEmail("dev@example.com");
        invitee.setGithubUsername("octodev");
        GithubCollaboratorInviteRequestDTO request = new GithubCollaboratorInviteRequestDTO();
        request.setIdentifier("dev@example.com");

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.ADMIN, 1L, "admin")));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration(project)));
        when(githubTokenService.getToken(1L)).thenReturn("admin-token");
        when(teamMemberRepository.findByTeamId(11L)).thenReturn(List.of(teamMemberForUser(invitee)));
        when(githubApiClient.addRepositoryCollaborator("planora/web", "octodev", "push", "admin-token"))
                .thenReturn(new GithubApiClient.CollaboratorInviteResult(201, objectMapper.createObjectNode()));

        GithubCollaboratorInviteResponseDTO response = service.inviteCollaborator(7L, request, 1L);

        assertEquals("octodev", response.getGithubUsername());
        verify(githubApiClient, never()).fetchPublicUser(any(), any());
        verify(githubApiClient).addRepositoryCollaborator("planora/web", "octodev", "push", "admin-token");
    }

    @Test
    void inviteCollaborator_resolvesStoredGithubEmailToGithubUsername() {
        Project project = project();
        User invitee = new User();
        invitee.setEmail("dev@planora.test");
        invitee.setGithubUsername("octodev");
        invitee.setGithubEmail("dev@users.noreply.github.com");
        GithubCollaboratorInviteRequestDTO request = new GithubCollaboratorInviteRequestDTO();
        request.setIdentifier("dev@users.noreply.github.com");

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.ADMIN, 1L, "admin")));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration(project)));
        when(githubTokenService.getToken(1L)).thenReturn("admin-token");
        when(teamMemberRepository.findByTeamId(11L)).thenReturn(List.of(teamMemberForUser(invitee)));
        when(githubApiClient.addRepositoryCollaborator("planora/web", "octodev", "push", "admin-token"))
                .thenReturn(new GithubApiClient.CollaboratorInviteResult(201, objectMapper.createObjectNode()));

        GithubCollaboratorInviteResponseDTO response = service.inviteCollaborator(7L, request, 1L);

        assertEquals("octodev", response.getGithubUsername());
        verify(githubApiClient).addRepositoryCollaborator("planora/web", "octodev", "push", "admin-token");
    }

    @Test
    void inviteCollaborator_rejectsUnresolvedEmail() {
        Project project = project();
        GithubCollaboratorInviteRequestDTO request = new GithubCollaboratorInviteRequestDTO();
        request.setIdentifier("dev@example.com");

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.ADMIN, 1L, "admin")));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration(project)));
        when(githubTokenService.getToken(1L)).thenReturn("admin-token");
        when(teamMemberRepository.findByTeamId(11L)).thenReturn(List.of());

        assertThrows(BadRequestException.class, () -> service.inviteCollaborator(7L, request, 1L));
    }

    @Test
    void inviteCollaborator_mapsGithubValidationFailure() {
        Project project = project();
        GithubCollaboratorInviteRequestDTO request = new GithubCollaboratorInviteRequestDTO();
        request.setIdentifier("octocat");

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.ADMIN, 1L, "admin")));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration(project)));
        when(githubTokenService.getToken(1L)).thenReturn("admin-token");
        when(githubApiClient.fetchPublicUser("octocat", "admin-token"))
                .thenReturn(objectMapper.createObjectNode().put("login", "octocat"));
        when(githubApiClient.addRepositoryCollaborator("planora/web", "octocat", "push", "admin-token"))
                .thenThrow(new GithubApiClient.GithubApiException(422, "validation failed"));

        assertThrows(GithubIssueValidationException.class, () -> service.inviteCollaborator(7L, request, 1L));
    }

    @Test
    void inviteCollaborator_mapsGithubForbidden() {
        Project project = project();
        GithubCollaboratorInviteRequestDTO request = new GithubCollaboratorInviteRequestDTO();
        request.setIdentifier("octocat");

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.ADMIN, 1L, "admin")));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration(project)));
        when(githubTokenService.getToken(1L)).thenReturn("admin-token");
        when(githubApiClient.fetchPublicUser("octocat", "admin-token"))
                .thenReturn(objectMapper.createObjectNode().put("login", "octocat"));
        when(githubApiClient.addRepositoryCollaborator("planora/web", "octocat", "push", "admin-token"))
                .thenThrow(new GithubApiClient.GithubApiException(403, "forbidden"));

        assertThrows(ForbiddenException.class, () -> service.inviteCollaborator(7L, request, 1L));
    }

    @Test
    void inviteCollaborator_mapsGithubUserNotFound() {
        Project project = project();
        GithubCollaboratorInviteRequestDTO request = new GithubCollaboratorInviteRequestDTO();
        request.setIdentifier("missing-user");

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.ADMIN, 1L, "admin")));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration(project)));
        when(githubTokenService.getToken(1L)).thenReturn("admin-token");
        when(githubApiClient.fetchPublicUser("missing-user", "admin-token"))
                .thenThrow(new GithubApiClient.GithubApiException(404, "not found"));

        assertThrows(GithubRepositoryNotFoundException.class, () -> service.inviteCollaborator(7L, request, 1L));
        verify(githubApiClient, never()).addRepositoryCollaborator(any(), any(), any(), any());
    }

    @Test
    void inviteCollaborator_mapsGithubRateLimit() {
        Project project = project();
        GithubCollaboratorInviteRequestDTO request = new GithubCollaboratorInviteRequestDTO();
        request.setIdentifier("octocat");

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.ADMIN, 1L, "admin")));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration(project)));
        when(githubTokenService.getToken(1L)).thenReturn("admin-token");
        when(githubApiClient.fetchPublicUser("octocat", "admin-token"))
                .thenReturn(objectMapper.createObjectNode().put("login", "octocat"));
        when(githubApiClient.addRepositoryCollaborator("planora/web", "octocat", "push", "admin-token"))
                .thenThrow(new GithubApiClient.GithubApiException(429, "rate limit"));

        assertThrows(GithubRateLimitException.class, () -> service.inviteCollaborator(7L, request, 1L));
    }

    @Test
    void linkRepository_deactivatesPreviousActiveIntegrations() {
        Project project = project();
        project.setGithubRepoFullName("planora/old-repo");
        GithubIntegration oldIntegration = integration(project);
        oldIntegration.setId(10L);
        oldIntegration.setRepositoryFullName("planora/old-repo");
        oldIntegration.setActive(true);

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.OWNER, 1L, "owner")));
        when(githubTokenService.getToken(1L)).thenReturn("token");
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(oldIntegration));
        when(integrationRepository.findByProjectIdAndRepositoryFullName(7L, "planora/new-repo")).thenReturn(Optional.empty());
        when(integrationRepository.save(any(GithubIntegration.class))).thenAnswer(invocation -> {
            GithubIntegration arg = invocation.getArgument(0);
            if (arg.getId() == null) arg.setId(20L);
            return arg;
        });

        GithubLinkRequestDTO request = new GithubLinkRequestDTO();
        request.setProjectId(7L);
        request.setRepositoryFullName("planora/new-repo");

        var result = service.linkRepository(request, 1L);

        assertEquals("planora/new-repo", result.getRepositoryFullName());
        assertEquals("planora/new-repo", project.getGithubRepoFullName());
        org.junit.jupiter.api.Assertions.assertFalse(oldIntegration.isActive());
        verify(integrationRepository).save(oldIntegration);
        verify(projectRepository).save(project);
    }

    @Test
    void unlinkRepository_clearsProjectGithubRepoFullNameWhenNoActiveRemain() {
        Project project = project();
        project.setGithubRepoFullName("planora/web");
        GithubIntegration integration = integration(project);

        when(projectRepository.findById(7L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 1L)).thenReturn(Optional.of(member(TeamRole.OWNER, 1L, "owner")));
        when(integrationRepository.findByIdAndProjectId(42L, 7L)).thenReturn(Optional.of(integration));
        when(integrationRepository.findByProjectIdAndActiveTrue(7L)).thenReturn(List.of(integration));

        service.unlinkRepository(42L, 7L, 1L);

        verify(integrationRepository).delete(integration);
        org.junit.jupiter.api.Assertions.assertNull(project.getGithubRepoFullName());
        verify(projectRepository).save(project);
    }

    private Project project() {
        Team team = new Team();
        team.setId(11L);
        Project project = new Project();
        project.setId(7L);
        project.setTeam(team);
        return project;
    }

    private GithubIntegration integration(Project project) {
        GithubIntegration integration = new GithubIntegration();
        integration.setId(42L);
        integration.setProject(project);
        integration.setRepositoryFullName("planora/web");
        integration.setRepositoryUrl("https://github.com/planora/web");
        integration.setActive(true);
        return integration;
    }

    private TeamMember member(TeamRole role, Long userId, String githubUsername) {
        Team team = new Team();
        team.setId(11L);
        User user = new User();
        user.setUserId(userId);
        user.setGithubUsername(githubUsername);
        TeamMember member = new TeamMember();
        member.setTeam(team);
        member.setUser(user);
        member.setRole(role);
        return member;
    }

    private TeamMember teamMemberForUser(User user) {
        Team team = new Team();
        team.setId(11L);
        TeamMember member = new TeamMember();
        member.setTeam(team);
        member.setUser(user);
        member.setRole(TeamRole.MEMBER);
        return member;
    }
}
