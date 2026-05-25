package com.planora.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.model.CiStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Processes incoming GitHub webhook events.
 *
 * Validates HMAC-SHA256 signatures, dispatches by event type, and delegates
 * state changes to the appropriate domain services. No HTTP layer here.
 */
@Service
public class GithubWebhookService {

    private static final Logger log = LoggerFactory.getLogger(GithubWebhookService.class);

    @Autowired private GithubCommitService commitService;
    @Autowired private CiStatusResolver    ciStatusResolver;
    @Autowired private ObjectMapper        objectMapper;

    /**
     * Entry point called by the webhook controller.
     *
     * @return a short status string suitable for the HTTP response body
     */
    public String processWebhook(String eventType,
                                  String signature,
                                  String rawBody,
                                  String webhookSecret) {
        if (!isBlank(webhookSecret) && !isValidSignature(rawBody, signature, webhookSecret)) {
            log.warn("Webhook rejected: invalid signature for event '{}'", eventType);
            return "INVALID_SIGNATURE";
        }
        if (isBlank(webhookSecret)) {
            log.warn("Webhook received without secret validation — set GITHUB_WEBHOOK_SECRET in production");
        }

        JsonNode body;
        try {
            body = objectMapper.readTree(rawBody);
        } catch (Exception e) {
            log.error("Failed to parse webhook body", e);
            return "MALFORMED_JSON";
        }

        return switch (eventType) {
            case "check_run"    -> handleCheckRun(body);
            case "push"         -> handlePush(body);
            case "pull_request" -> handlePullRequest(body);
            case "ping"         -> "pong";
            default             -> {
                log.debug("Webhook event '{}' received — no action taken", eventType);
                yield "ignored";
            }
        };
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    private String handleCheckRun(JsonNode body) {
        String   action   = body.path("action").asText("");
        JsonNode checkRun = body.path("check_run");
        String   headSha  = checkRun.path("head_sha").asText("").trim();

        if (headSha.isEmpty()) return "missing_sha";

        if (!commitService.hasCommitWithSha(headSha)) return "no_matching_task";

        CiStatus resolved;
        if ("rerequested".equals(action)) {
            resolved = CiStatus.RUNNING;
        } else {
            resolved = ciStatusResolver.resolveFromCheckRunEvent(checkRun);
        }

        if (resolved == CiStatus.UNKNOWN) return "unresolvable_status";

        commitService.updateCiStatusBySha(headSha, resolved);
        log.info("CI status updated to {} for SHA {}",
                resolved, headSha.length() >= 7 ? headSha.substring(0, 7) : headSha);
        return "updated";
    }

    private String handlePush(JsonNode body) {
        // Push events indicate new commits — a scheduled sync will pick them up.
        // For now, log the ref so it's visible in diagnostics without triggering an
        // immediate sync (which would require a full task scan).
        String ref = body.path("ref").asText("");
        log.debug("Push event received for ref '{}'", ref);
        return "received";
    }

    private String handlePullRequest(JsonNode body) {
        // PR state changes (opened, closed, merged) will be reflected on the next sync.
        String action = body.path("action").asText("");
        log.debug("pull_request event '{}' received", action);
        return "received";
    }

    // ── HMAC validation ───────────────────────────────────────────────────────

    private boolean isValidSignature(String rawBody, String signature, String secret) {
        if (signature == null || !signature.startsWith("sha256=")) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
            byte[] received = hexToBytes(signature.substring("sha256=".length()));
            return MessageDigest.isEqual(expected, received);
        } catch (NoSuchAlgorithmException | InvalidKeyException | IllegalArgumentException e) {
            log.error("Webhook signature validation error", e);
            return false;
        }
    }

    private static byte[] hexToBytes(String hex) {
        if (hex.length() % 2 != 0) throw new IllegalArgumentException("Odd hex length");
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < hex.length(); i += 2) {
            int hi = Character.digit(hex.charAt(i),     16);
            int lo = Character.digit(hex.charAt(i + 1), 16);
            if (hi < 0 || lo < 0) throw new IllegalArgumentException("Non-hex char");
            out[i / 2] = (byte) ((hi << 4) | lo);
        }
        return out;
    }

    private boolean isBlank(String s) { return s == null || s.isBlank(); }
}
