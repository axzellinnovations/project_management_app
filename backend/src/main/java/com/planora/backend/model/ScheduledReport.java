package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Persisted configuration for a one-time or recurring scheduled report email.
 */
@Entity
@Table(name = "scheduled_reports")
@Getter
@Setter
@NoArgsConstructor
public class ScheduledReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Project this report belongs to. */
    @Column(name = "project_id", nullable = false)
    private Long projectId;

    /** The user who created this schedule. */
    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    // ── Format & Schedule type ──────────────────────────────────────────────

    /** PDF | EXCEL | BOTH */
    @Column(nullable = false, length = 10)
    private String format;

    /** ONE_TIME | RECURRING */
    @Column(name = "schedule_type", nullable = false, length = 20)
    private String scheduleType;

    // ── Recurrence config (null for ONE_TIME) ──────────────────────────────

    /** DAILY | WEEKLY | MONTHLY | CUSTOM */
    @Column(length = 20)
    private String frequency;

    @Column(name = "custom_interval_days")
    private Integer customIntervalDays;

    /** HH:mm local time for the scheduled email */
    @Column(name = "send_time", nullable = false, length = 10)
    private String sendTime;

    /** 0=Sun … 6=Sat for WEEKLY frequency */
    @Column(name = "send_day_of_week")
    private Integer sendDayOfWeek;

    /** 1-31 for MONTHLY frequency */
    @Column(name = "send_day_of_month")
    private Integer sendDayOfMonth;

    /** ISO date string (YYYY-MM-DD) for ONE_TIME */
    @Column(name = "scheduled_date")
    private LocalDate scheduledDate;

    /** Timezone ID (e.g. "Asia/Kolkata") */
    @Column(length = 50)
    private String timezone = "UTC";

    // ── Recipients ──────────────────────────────────────────────────────────

    /** Comma-separated To emails. */
    @Column(name = "recipients_to", nullable = false, columnDefinition = "TEXT")
    private String recipientsTo;

    /** Comma-separated CC emails (nullable). */
    @Column(name = "recipients_cc", columnDefinition = "TEXT")
    private String recipientsCc;

    /** Comma-separated BCC emails (nullable). */
    @Column(name = "recipients_bcc", columnDefinition = "TEXT")
    private String recipientsBcc;

    // ── Email content ───────────────────────────────────────────────────────

    @Column(length = 500)
    private String subject;

    @Column(name = "body_message", columnDefinition = "TEXT")
    private String bodyMessage;

    // ── End conditions (RECURRING only) ────────────────────────────────────

    /** AFTER_N | UNTIL_DATE | MANUAL */
    @Column(name = "end_type", length = 20)
    private String endType;

    @Column(name = "end_after_count")
    private Integer endAfterCount;

    @Column(name = "end_date")
    private LocalDate endDate;

    // ── Runtime tracking ────────────────────────────────────────────────────

    @Column(name = "send_count", nullable = false)
    private int sendCount = 0;

    /** ACTIVE | PAUSED | COMPLETED | CANCELLED */
    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "next_send_at")
    private Instant nextSendAt;

    @Column(name = "last_sent_at")
    private Instant lastSentAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
