package com.planora.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.model.CiStatus;
import com.planora.backend.service.CiStatusResolver;
import com.planora.backend.service.TaskGithubService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Receives GitHub webhook events and applies real-time CI status updates to tasks.
 *
 * Endpoint: POST /api/github/webhooks
 *
 * Supported event types (via X-GitHub-Event header):
 *   check_run  — updates ci_status on the matching commit row when a check run completes
 *   ping       — accepted and acknowledged (GitHub sends this on webhook creation)
 *
 * All other event types receive a 200 OK with no action taken.
 *
 * Security:
 *   GitHub signs every delivery with HMAC-SHA256 using the configured webhook secret.
 *   The signature is compared using a constant-time algorithm to prevent timing attacks.
 *   If no secret is configured (GITHUB_WEBHOOK_SECRET is empty) the endpoint accepts
 *   all deliveries in development mode — a warning is logged on every delivery.
 */
@RestController
@RequestMapping("/api/github/webhooks")
public class GitHubWebhookController {

    private static final Logger log = LoggerFactory.getLogger(GitHubWebhookController.class);

    @Value("${github.webhook.secret:}")
    private String webhookSecret;

    @Autowired
    private CiStatusResolver ciStatusResolver;

    @Autowired
    private TaskGithubService taskGithubService;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Main webhook receiver. Reads the body as a raw string so the exact bytes
     * can be used for HMAC-SHA256 signature validation before parsing JSON.
     *
     * @param eventType value of the X-GitHub-Event header (e.g. "check_run", "ping")
     * @param signature value of the X-Hub-Signature-256 header (e.g. "sha256=abc…")
     * @param rawBody   raw request body as text — preserved for HMAC computation
     */
    @PostMapping(consumes = "application/json")
    public ResponseEntity<String> handleWebhook(
            @RequestHeader(value = "X-GitHub-Event",      defaultValue = "") String eventType,
            @RequestHeader(value = "X-Hub-Signature-256", defaultValue = "") String signature,
            @RequestBody String rawBody) {

        if (!webhookSecret.isBlank() && !isValidSignature(rawBody, signature)) {
            log.warn("GitHub webhook rejected: invalid signature for event '{}'", eventType);
            return ResponseEntity.status(401).body("Invalid signature");
        }
        if (webhookSecret.isBlank()) {
            log.warn("GitHub webhook received without secret validation — set GITHUB_WEBHOOK_SECRET in production");
        }

        JsonNode body;
        try {
            body = objectMapper.readTree(rawBody);
        } catch (Exception e) {
            log.error("Failed to parse GitHub webhook body", e);
            return ResponseEntity.badRequest().body("Malformed JSON");
        }

        return switch (eventType) {
            case "check_run" -> handleCheckRun(body);
            case "ping"      -> ResponseEntity.ok("pong");
            default          -> {
                log.debug("GitHub webhook event '{}' received — no action taken", eventType);
                yield ResponseEntity.ok("ignored");
            }
        };
    }

    // ── Event handlers ────────────────────────────────────────────────────────────

    /**
     * Handles a {@code check_run} event.
     *
     * Resolves the CI status from the event payload and persists it to every
     * commit row in the DB that matches the {@code head_sha}. Skips writes when
     * the resolved status is UNKNOWN to avoid overwriting useful existing data.
     *
     * Webhook body shape:
     * <pre>
     * {
     *   "action": "completed" | "created" | "rerequested" | "requested_action",
     *   "check_run": {
     *     "status":     "completed" | "in_progress" | "queued",
     *     "conclusion": "success" | "failure" | ...,
     *     "head_sha":   "<40-char SHA>"
     *   }
     * }
     * </pre>
     */
    private ResponseEntity<String> handleCheckRun(JsonNode body) {
        String action     = body.path("action").asText("");
        JsonNode checkRun = body.path("check_run");
        String   headSha  = checkRun.path("head_sha").asText("").trim();

        if (headSha.isEmpty()) {
            return ResponseEntity.badRequest().body("Missing head_sha");
        }

        // Skip events for commits not stored in our DB — avoids unnecessary writes.
        if (!taskGithubService.hasCommitWithSha(headSha)) {
            return ResponseEntity.ok("no matching task");
        }

        CiStatus resolved;
        if ("rerequested".equals(action)) {
            // User manually re-triggered the check — treat as running until a result arrives.
            resolved = CiStatus.RUNNING;
        } else {
            resolved = ciStatusResolver.resolveFromCheckRunEvent(checkRun);
        }

        // Do not overwrite real data with UNKNOWN — wait for a conclusive event.
        if (resolved == CiStatus.UNKNOWN) {
            return ResponseEntity.ok("unresolvable status — skipped");
        }

        taskGithubService.updateCiStatusBySha(headSha, resolved);
        log.info("CI status updated to {} for SHA {}", resolved,
                headSha.length() >= 7 ? headSha.substring(0, 7) : headSha);
        return ResponseEntity.ok("updated");
    }

    // ── HMAC validation ───────────────────────────────────────────────────────────

    /**
     * Validates the {@code X-Hub-Signature-256} header against the raw request body
     * using HMAC-SHA256 and the configured webhook secret.
     *
     * Comparison uses {@link MessageDigest#isEqual} (constant-time) to prevent timing attacks.
     */
    private boolean isValidSignature(String rawBody, String signature) {
        if (signature == null || !signature.startsWith("sha256=")) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
            byte[] received = hexStringToBytes(signature.substring("sha256=".length()));
            return MessageDigest.isEqual(expected, received);
        } catch (NoSuchAlgorithmException | InvalidKeyException | IllegalArgumentException e) {
            log.error("Webhook signature validation error", e);
            return false;
        }
    }

    private static byte[] hexStringToBytes(String hex) {
        if (hex.length() % 2 != 0) throw new IllegalArgumentException("Odd hex length");
        byte[] data = new byte[hex.length() / 2];
        for (int i = 0; i < hex.length(); i += 2) {
            int hi = Character.digit(hex.charAt(i),     16);
            int lo = Character.digit(hex.charAt(i + 1), 16);
            if (hi < 0 || lo < 0) throw new IllegalArgumentException("Non-hex character");
            data[i / 2] = (byte) ((hi << 4) | lo);
        }
        return data;
    }
}
