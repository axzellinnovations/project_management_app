package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Full commit response for GET /api/tasks/{taskId}/commits.
 *
 * Commits are sorted by committedAt descending (newest first).
 * Results are capped at the limit requested by the caller (default 20, max 50).
 *
 * ciStatus values: "PASSING" | "FAILED" | "RUNNING" | null (null = no CI data for this commit)
 *
 * referencedTaskNumbers: task numbers extracted from the commit message using
 *   the patterns "#<number>" and "TASK-<number>" (case-insensitive).
 *   These are raw projectTaskNumber integers — the frontend resolves them
 *   against the current project's tasks. Empty list when no references are found.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LinkedCommitResponseDTO {

    private Long         id;
    private String       sha;                    // 7-char short SHA for display
    private String       fullSha;                // 40-char full SHA (for copy/webhook matching)
    private String       message;                // first line of the commit message
    private String       author;
    private String       committedAt;            // ISO-8601 UTC string from GitHub
    private String       htmlUrl;
    private String       ciStatus;               // normalized CiStatus name or null
    private List<Integer> referencedTaskNumbers; // task numbers mentioned in the message
}
