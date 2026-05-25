package com.planora.backend.controller;

import com.planora.backend.service.GithubWebhookService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Receives GitHub webhook deliveries.
 *
 * Registered on two paths to support both legacy webhook configurations and new ones:
 *   POST /api/github/webhooks  — original path (kept for backwards compatibility)
 *   POST /api/github/webhook   — new singular path for fresh webhook registrations
 *
 * Supported events: check_run, push, pull_request, ping.
 * All logic is delegated to GithubWebhookService (HMAC validation + event handling).
 */
@RestController
@RequestMapping({"/api/github/webhooks", "/api/github/webhook"})
public class GitHubWebhookController {

    @Value("${github.webhook.secret:}")
    private String webhookSecret;

    @Autowired
    private GithubWebhookService webhookService;

    @PostMapping(consumes = "application/json")
    public ResponseEntity<String> handleWebhook(
            @RequestHeader(value = "X-GitHub-Event",      defaultValue = "") String eventType,
            @RequestHeader(value = "X-Hub-Signature-256", defaultValue = "") String signature,
            @RequestBody String rawBody) {

        String result = webhookService.processWebhook(eventType, signature, rawBody, webhookSecret);

        return switch (result) {
            case "INVALID_SIGNATURE" -> ResponseEntity.status(401).body("Invalid signature");
            case "MALFORMED_JSON"    -> ResponseEntity.badRequest().body("Malformed JSON");
            default                  -> ResponseEntity.ok(result);
        };
    }
}
