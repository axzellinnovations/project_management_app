package com.planora.backend.controller;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.GithubCommitDTO;
import com.planora.backend.dto.GithubCreateIssueRequestDTO;
import com.planora.backend.dto.GithubIssueDTO;
import com.planora.backend.dto.GithubPrDTO;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.Project;
import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.repository.GithubIntegrationRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.GithubCommitService;
import com.planora.backend.service.GithubIssueService;
import com.planora.backend.service.GithubNotificationService;
import com.planora.backend.service.GithubPullRequestService;
import com.planora.backend.service.GithubSyncService;
import com.planora.backend.service.JWTService;

@WebMvcTest(GithubDataController.class)
@SuppressWarnings("unused")
class GithubDataControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private GithubPullRequestService pullRequestService;

    @MockitoBean
    private GithubCommitService commitService;

    @MockitoBean
    private GithubIssueService issueService;

    @MockitoBean
    private GithubSyncService syncService;

    @MockitoBean
    private GithubNotificationService githubNotificationService;

    @MockitoBean
    private com.planora.backend.service.GithubTokenService githubTokenService;

    @MockitoBean
    private GithubIntegrationRepository githubIntegrationRepository;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    private User userEntity;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        userEntity = new User();
        userEntity.setUserId(7L);
        userEntity.setUsername("alice");
        userEntity.setEmail("alice@example.com");
        userEntity.setGithubUsername("octocat");
        userEntity.setGithubAccessToken("github-token");
        principal = new UserPrincipal(userEntity);
    }

    @Test
    void getPullRequests_returnsStablePageResponse() throws Exception {
        GithubPrDTO pr = GithubPrDTO.builder()
                .id(1L)
                .githubPrNumber(17)
                .title("Ship stable pages")
                .build();
        when(pullRequestService.getPullRequests(10L, "all", 1, 1, 7L))
                .thenReturn(new PageImpl<>(List.of(pr), PageRequest.of(1, 1), 3));

        mockMvc.perform(get("/api/github/project/10/pull-requests")
                        .param("page", "1")
                        .param("size", "1")
                        .with(user(principal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].title").value("Ship stable pages"))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.number").value(1))
                .andExpect(jsonPath("$.first").value(false))
                .andExpect(jsonPath("$.last").value(false))
                .andExpect(jsonPath("$.empty").value(false))
                .andExpect(jsonPath("$.numberOfElements").value(1))
                .andExpect(jsonPath("$.pageable").doesNotExist())
                .andExpect(jsonPath("$.sort").doesNotExist());
    }

    @Test
    void getCommits_returnsStablePageResponse() throws Exception {
        GithubCommitDTO commit = GithubCommitDTO.builder()
                .id(2L)
                .shortSha("abc1234")
                .message("Fix serialization")
                .build();
        when(commitService.getCommits(10L, 0, 1, 7L))
                .thenReturn(new PageImpl<>(List.of(commit), PageRequest.of(0, 1), 1));

        mockMvc.perform(get("/api/github/project/10/commits")
                        .param("size", "1")
                        .with(user(principal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].message").value("Fix serialization"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.first").value(true))
                .andExpect(jsonPath("$.last").value(true))
                .andExpect(jsonPath("$.empty").value(false))
                .andExpect(jsonPath("$.numberOfElements").value(1))
                .andExpect(jsonPath("$.pageable").doesNotExist())
                .andExpect(jsonPath("$.sort").doesNotExist());
    }

    @Test
    void getIssues_returnsStablePageResponse() throws Exception {
        GithubIssueDTO issue = GithubIssueDTO.builder()
                .id(3L)
                .number(34)
                .title("Fix login")
                .state("open")
                .build();
        when(issueService.getIssues(10L, "open", 0, 1, 7L))
                .thenReturn(new PageImpl<>(List.of(issue), PageRequest.of(0, 1), 1));

        mockMvc.perform(get("/api/github/project/10/issues")
                        .param("size", "1")
                        .with(user(principal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].title").value("Fix login"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.first").value(true))
                .andExpect(jsonPath("$.last").value(true))
                .andExpect(jsonPath("$.empty").value(false))
                .andExpect(jsonPath("$.numberOfElements").value(1))
                .andExpect(jsonPath("$.pageable").doesNotExist())
                .andExpect(jsonPath("$.sort").doesNotExist());
    }

    @Test
    void createIssue_notifiesGitHubListenersAfterSuccess() throws Exception {
        GithubIntegration integration = new GithubIntegration();
        integration.setId(19L);
        Project project = new Project();
        project.setId(10L);
        integration.setProject(project);
        integration.setRepositoryFullName("planora/app");

        GithubIssueDTO createdIssue = new GithubIssueDTO();
        createdIssue.setNumber(34);
        createdIssue.setTitle("Fix login");
        createdIssue.setBody("Details");

        when(issueService.createIssue(19L, "Fix login", "Details", List.of("bug")))
                .thenReturn(createdIssue);
        when(githubIntegrationRepository.findByIdAndProjectId(19L, 10L)).thenReturn(Optional.of(integration));
        when(userRepository.findById(7L)).thenReturn(Optional.of(userEntity));

        GithubCreateIssueRequestDTO request = new GithubCreateIssueRequestDTO();
        request.setIntegrationId(19L);
        request.setTitle("Fix login");
        request.setBody("Details");
        request.setLabels(List.of("bug"));

        mockMvc.perform(post("/api/github/project/10/issues")
                        .with(user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.number").value(34));

        verify(githubNotificationService).notifyIssueEvent(
                "planora/app",
                34,
                "Fix login",
                "opened",
                "octocat",
                "Details",
                List.of("bug"));
    }
}
