package com.planora.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.planora.backend.dto.GithubRepositoryDTO;
import com.planora.backend.model.GithubIntegration;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.GithubApiClient;
import com.planora.backend.service.GithubTokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Manages GitHub repository connections for Planora projects.
 *
 * Endpoints:
 *   POST   /api/github/integrations                      — connect a repo to a project
 *   GET    /api/github/integrations/project/{projectId}  — get integration status
 *   DELETE /api/github/integrations/project/{projectId}  — disconnect a repo
 *   GET    /api/github/repositories                      — list repos for the calling user
 */
@RestController
@RequestMapping("/api/github")
public class GithubIntegrationController {

    private static final Logger log = LoggerFactory.getLogger(GithubIntegrationController.class);

    @Autowired private GithubTokenService githubTokenService;
    @Autowired private GithubApiClient    apiClient;

    @PostMapping("/integrations")
    public ResponseEntity<?> connectRepo(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal principal) {

        String repoFullName = body.get("repoFullName");
        String token        = body.get("token");

        if (repoFullName == null || repoFullName.isBlank()) {
            return ResponseEntity.badRequest().body("repoFullName is required");
        }
        if (token == null || token.isBlank()) {
            return ResponseEntity.badRequest().body("token is required");
        }

        String projectIdStr = body.get("projectId");
        if (projectIdStr == null) {
            return ResponseEntity.badRequest().body("projectId is required");
        }
        long projectId;
        try {
            projectId = Long.parseLong(projectIdStr);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body("projectId must be a number");
        }

        GithubIntegration saved = githubTokenService.saveIntegration(
                projectId, repoFullName, token, principal.getUserId());

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id",           saved.getId(),
                "projectId",    saved.getProjectId(),
                "repoFullName", saved.getRepoFullName(),
                "connectedAt",  saved.getConnectedAt().toString()
        ));
    }

    @GetMapping("/integrations/project/{projectId}")
    public ResponseEntity<?> getIntegration(@PathVariable Long projectId) {
        Optional<GithubIntegration> opt = githubTokenService.getIntegration(projectId);
        if (opt.isEmpty()) {
            return ResponseEntity.ok(Map.of("connected", false));
        }
        GithubIntegration i = opt.get();
        return ResponseEntity.ok(Map.of(
                "connected",    true,
                "repoFullName", i.getRepoFullName(),
                "connectedAt",  i.getConnectedAt().toString()
        ));
    }

    @DeleteMapping("/integrations/project/{projectId}")
    public ResponseEntity<Void> disconnectRepo(@PathVariable Long projectId) {
        githubTokenService.deactivate(projectId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/repositories")
    public ResponseEntity<?> listRepositories(
            @RequestHeader(value = "X-GitHub-Token", required = false) String headerToken,
            @RequestParam(value  = "projectId",       required = false) Long projectId) {

        String token = resolveToken(headerToken, projectId);
        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("No GitHub token available. Connect a repository first.");
        }

        JsonNode reposNode = apiClient.fetchUserRepositories(token);
        if (reposNode == null || !reposNode.isArray()) {
            return ResponseEntity.ok(List.of());
        }

        List<GithubRepositoryDTO> result = new ArrayList<>();
        for (JsonNode r : reposNode) {
            result.add(GithubRepositoryDTO.builder()
                    .repoId(r.path("id").asLong())
                    .name(r.path("name").asText(""))
                    .fullName(r.path("full_name").asText(""))
                    .privateRepo(r.path("private").asBoolean(false))
                    .defaultBranch(r.path("default_branch").asText("main"))
                    .ownerLogin(r.path("owner").path("login").asText(""))
                    .description(r.path("description").isNull() ? null
                            : r.path("description").asText(null))
                    .build());
        }
        return ResponseEntity.ok(result);
    }

    private String resolveToken(String headerToken, Long projectId) {
        if (headerToken != null && !headerToken.isBlank()) return headerToken;
        if (projectId != null) return githubTokenService.getToken(projectId).orElse(null);
        return null;
    }
}
