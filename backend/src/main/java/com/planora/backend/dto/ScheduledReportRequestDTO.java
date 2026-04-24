package com.planora.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Request DTO for creating a new scheduled report.
 */
@Getter
@Setter
public class ScheduledReportRequestDTO {

    @NotNull
    private Long projectId;

    /** PDF | EXCEL | BOTH */
    @NotBlank
    private String format;

    /** ONE_TIME | RECURRING */
    @NotBlank
    private String scheduleType;

    // ── Recurrence config ────────────────────────────────────────────────────

    /** DAILY | WEEKLY | MONTHLY | CUSTOM  (null for ONE_TIME) */
    private String frequency;

    /** Used when frequency = CUSTOM */
    private Integer customIntervalDays;

    /** HH:mm — required */
    @NotBlank
    private String sendTime;

    /** 0=Sun … 6=Sat for WEEKLY */
    private Integer sendDayOfWeek;

    /** 1-31 for MONTHLY */
    private Integer sendDayOfMonth;

    /** ISO date string (YYYY-MM-DD) for ONE_TIME */
    private String scheduledDate;

    /** Timezone string from client (e.g. Asia/Kolkata). Defaults to UTC. */
    private String timezone;

    // ── Recipients ───────────────────────────────────────────────────────────

    @NotEmpty
    private List<String> recipientsTo;
    private List<String> recipientsCc;
    private List<String> recipientsBcc;

    // ── Email content ────────────────────────────────────────────────────────

    private String subject;
    private String bodyMessage;

    // ── End condition (RECURRING) ────────────────────────────────────────────

    /** AFTER_N | UNTIL_DATE | MANUAL */
    private String endType;
    private Integer endAfterCount;

    /** ISO date string (YYYY-MM-DD) */
    private String endDate;
}
