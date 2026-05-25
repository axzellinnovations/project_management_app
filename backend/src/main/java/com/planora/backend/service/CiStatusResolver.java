package com.planora.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.planora.backend.model.CiStatus;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

/**
 * Reusable CI status resolver that maps raw GitHub API responses to the
 * normalized {@link CiStatus} enum used throughout Planora.
 *
 * Three resolution sources are supported:
 *   1. GitHub Check Runs API response body   (v3 Checks API — preferred)
 *   2. GitHub Commit Statuses API response   (legacy Statuses API — fallback)
 *   3. A stored DB string                    (handles old raw values + new normalized names)
 *   4. A single check_run webhook event node (for real-time webhook updates)
 *
 * The resolver is stateless — safe to call from any context.
 */
@Component
public class CiStatusResolver {

    /**
     * Resolves overall CI status from a GitHub Check Runs API response body.
     * Expected shape: {@code { "total_count": N, "check_runs": [ ... ] }}
     *
     * Rules (short-circuit on first FAILED):
     *   Any failure conclusion → FAILED
     *   Any in-progress/queued → RUNNING
     *   All success/neutral    → PASSING
     *   No runs present        → UNKNOWN
     */
    public CiStatus resolveFromCheckRuns(JsonNode body) {
        if (body == null) return CiStatus.UNKNOWN;
        JsonNode runs = body.path("check_runs");
        if (!runs.isArray() || runs.isEmpty()) return CiStatus.UNKNOWN;

        boolean anyRunning = false;
        boolean anyPassing = false;

        for (JsonNode run : runs) {
            String status     = run.path("status").asText("");
            String conclusion = run.path("conclusion").asText("");

            CiStatus mapped = CiStatus.fromGitHub(
                    status,
                    conclusion.isEmpty() || "null".equalsIgnoreCase(conclusion) ? null : conclusion
            );
            if (mapped == CiStatus.FAILED)  return CiStatus.FAILED;   // fail-fast
            if (mapped == CiStatus.RUNNING) anyRunning = true;
            if (mapped == CiStatus.PASSING) anyPassing = true;
        }

        if (anyRunning) return CiStatus.RUNNING;
        if (anyPassing) return CiStatus.PASSING;
        return CiStatus.UNKNOWN;
    }

    /**
     * Resolves overall CI status from a GitHub Commit Statuses API response body.
     * Expected shape: array of {@code { "state": "...", "context": "..." }}
     *
     * The array is newest-first; only the first occurrence of each context is used.
     *
     * Rules:
     *   Any "failure"/"error" → FAILED
     *   Any "pending"         → RUNNING
     *   All "success"         → PASSING
     *   Empty array           → UNKNOWN
     */
    public CiStatus resolveFromCommitStatuses(JsonNode body) {
        if (body == null || !body.isArray() || body.isEmpty()) return CiStatus.UNKNOWN;

        boolean anyRunning = false;
        boolean anyPassing = false;
        Set<String> seenContexts = new HashSet<>();

        for (JsonNode statusNode : body) {
            String context = statusNode.path("context").asText("default");
            if (!seenContexts.add(context)) continue;  // older entry for same context — skip

            String state  = statusNode.path("state").asText("");
            CiStatus mapped = CiStatus.fromGitHubLegacyState(state);
            if (mapped == CiStatus.FAILED)  return CiStatus.FAILED;
            if (mapped == CiStatus.RUNNING) anyRunning = true;
            if (mapped == CiStatus.PASSING) anyPassing = true;
        }

        if (anyRunning) return CiStatus.RUNNING;
        if (anyPassing) return CiStatus.PASSING;
        return CiStatus.UNKNOWN;
    }

    /**
     * Resolves a single {@code check_run} object from a GitHub webhook event.
     * The node should be the value of the {@code "check_run"} key in the webhook body.
     */
    public CiStatus resolveFromCheckRunEvent(JsonNode checkRunNode) {
        if (checkRunNode == null) return CiStatus.UNKNOWN;
        String status     = checkRunNode.path("status").asText("");
        String conclusion = checkRunNode.path("conclusion").asText("");
        return CiStatus.fromGitHub(
                status,
                conclusion.isEmpty() || "null".equalsIgnoreCase(conclusion) ? null : conclusion
        );
    }

    /**
     * Converts a stored DB string to {@link CiStatus}.
     * Handles both new normalized names and old raw GitHub strings.
     * Safe to call with null — returns UNKNOWN.
     */
    public CiStatus resolveFromStoredValue(String stored) {
        return CiStatus.fromStoredValue(stored);
    }

    /**
     * Combines a primary and a fallback status.
     * Returns {@code primary} unless it is UNKNOWN, in which case {@code fallback} is used.
     * For a stricter merge (FAILED beats everything), use {@link CiStatus#merge}.
     */
    public CiStatus combine(CiStatus primary, CiStatus fallback) {
        return (primary != CiStatus.UNKNOWN) ? primary : fallback;
    }
}
