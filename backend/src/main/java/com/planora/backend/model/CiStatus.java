package com.planora.backend.model;

/**
 * Normalized CI/CD status for Planora task responses.
 *
 * All stored DB values and API responses use these names — never raw GitHub strings.
 *
 * GitHub → Planora mapping:
 *   PASSING ← conclusion: "success", "neutral", "skipped"
 *   FAILED  ← conclusion: "failure", "cancelled", "timed_out", "action_required"
 *   RUNNING ← status: "in_progress", "queued", "waiting"; conclusion: "pending"
 *   UNKNOWN ← no CI data, API error, or unrecognised value
 */
public enum CiStatus {

    PASSING,
    FAILED,
    RUNNING,
    UNKNOWN;

    /**
     * Maps a raw GitHub check-run status + conclusion pair.
     * Pass null for {@code conclusion} when the run is not yet complete.
     */
    public static CiStatus fromGitHub(String status, String conclusion) {
        if (conclusion != null && !conclusion.isBlank() && !"null".equalsIgnoreCase(conclusion)) {
            return fromGitHubConclusion(conclusion);
        }
        if (status != null) {
            switch (status.toLowerCase()) {
                case "in_progress":
                case "queued":
                case "waiting":
                case "pending":
                    return RUNNING;
                default:
                    return UNKNOWN;
            }
        }
        return UNKNOWN;
    }

    /** Maps a GitHub check-run conclusion string. */
    public static CiStatus fromGitHubConclusion(String conclusion) {
        if (conclusion == null) return UNKNOWN;
        switch (conclusion.toLowerCase()) {
            case "success":
            case "neutral":
            case "skipped":
                return PASSING;
            case "failure":
            case "cancelled":
            case "timed_out":
            case "action_required":
                return FAILED;
            case "pending":
            case "in_progress":
            case "queued":
                return RUNNING;
            default:
                return UNKNOWN;
        }
    }

    /**
     * Maps a legacy GitHub commit status state (Statuses API).
     * Legacy states: "success", "failure", "pending", "error"
     */
    public static CiStatus fromGitHubLegacyState(String state) {
        if (state == null) return UNKNOWN;
        switch (state.toLowerCase()) {
            case "success": return PASSING;
            case "failure":
            case "error":   return FAILED;
            case "pending": return RUNNING;
            default:        return UNKNOWN;
        }
    }

    /**
     * Converts a stored DB value to the enum.
     * Handles both new normalized names ("PASSING") and old raw GitHub strings ("success").
     */
    public static CiStatus fromStoredValue(String stored) {
        if (stored == null || stored.isBlank()) return UNKNOWN;
        try {
            return CiStatus.valueOf(stored.toUpperCase());
        } catch (IllegalArgumentException ignored) {
            // Legacy raw GitHub values
        }
        switch (stored.toLowerCase()) {
            case "success": return PASSING;
            case "failure": return FAILED;
            case "pending": return RUNNING;
            default:        return UNKNOWN;
        }
    }

    /**
     * Combines two statuses by priority: FAILED > RUNNING > PASSING > UNKNOWN.
     * Used to merge check-run status with legacy commit-status as a fallback.
     */
    public static CiStatus merge(CiStatus a, CiStatus b) {
        if (a == FAILED  || b == FAILED)  return FAILED;
        if (a == RUNNING || b == RUNNING) return RUNNING;
        if (a == PASSING || b == PASSING) return PASSING;
        return UNKNOWN;
    }
}
