package com.planora.backend.service;

import com.planora.backend.dto.ScheduledReportRequestDTO;
import com.planora.backend.dto.ScheduledReportResponseDTO;
import com.planora.backend.model.ScheduledReport;
import com.planora.backend.repository.ScheduledReportRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Business logic for creating, updating, and managing scheduled report configs.
 */
@Service
public class ScheduledReportService {

    private static final Logger log = LoggerFactory.getLogger(ScheduledReportService.class);

    private final ScheduledReportRepository repo;

    public ScheduledReportService(ScheduledReportRepository repo) {
        this.repo = repo;
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    @Transactional
    public ScheduledReportResponseDTO create(ScheduledReportRequestDTO dto, Long callerUserId) {
        ScheduledReport sr = new ScheduledReport();
        sr.setProjectId(dto.getProjectId());
        sr.setCreatedByUserId(callerUserId);
        sr.setFormat(dto.getFormat().toUpperCase());
        sr.setScheduleType(dto.getScheduleType().toUpperCase());
        sr.setFrequency(dto.getFrequency() != null ? dto.getFrequency().toUpperCase() : null);
        sr.setCustomIntervalDays(dto.getCustomIntervalDays());
        sr.setSendTime(dto.getSendTime());
        sr.setSendDayOfWeek(dto.getSendDayOfWeek());
        sr.setSendDayOfMonth(dto.getSendDayOfMonth());

        if (dto.getScheduledDate() != null && !dto.getScheduledDate().isBlank()) {
            sr.setScheduledDate(LocalDate.parse(dto.getScheduledDate()));
        }

        sr.setTimezone(dto.getTimezone() != null && !dto.getTimezone().isBlank() ? dto.getTimezone() : "UTC");

        sr.setRecipientsTo(String.join(",", dto.getRecipientsTo()));
        if (dto.getRecipientsCc() != null) {
            sr.setRecipientsCc(String.join(",", dto.getRecipientsCc()));
        }
        if (dto.getRecipientsBcc() != null) {
            sr.setRecipientsBcc(String.join(",", dto.getRecipientsBcc()));
        }

        sr.setSubject(dto.getSubject());
        sr.setBodyMessage(dto.getBodyMessage());
        sr.setEndType(dto.getEndType());
        sr.setEndAfterCount(dto.getEndAfterCount());

        if (dto.getEndDate() != null && !dto.getEndDate().isBlank()) {
            sr.setEndDate(LocalDate.parse(dto.getEndDate()));
        }

        sr.setNextSendAt(computeNextSendAt(sr, null));
        sr.setStatus("ACTIVE");

        ScheduledReport saved = repo.save(sr);
        log.info("Created scheduled report id={} for project={}", saved.getId(), saved.getProjectId());
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<ScheduledReportResponseDTO> listByProject(Long projectId) {
        return repo.findByProjectIdOrderByCreatedAtDesc(projectId)
                   .stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public void delete(Long id) {
        repo.deleteById(id);
    }

    @Transactional
    public ScheduledReportResponseDTO pause(Long id) {
        ScheduledReport sr = repo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Schedule not found: " + id));
        sr.setStatus("PAUSED");
        return toDto(repo.save(sr));
    }

    @Transactional
    public ScheduledReportResponseDTO resume(Long id) {
        ScheduledReport sr = repo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Schedule not found: " + id));
        sr.setStatus("ACTIVE");
        // Recompute nextSendAt from now
        sr.setNextSendAt(computeNextSendAt(sr, Instant.now()));
        return toDto(repo.save(sr));
    }

    // ── Scheduler helper (called by ReportEmailScheduler) ────────────────────

    /**
     * Called after a report email is sent.
     * Advances nextSendAt for recurring schedules; marks ONE_TIME / finished recurrences as COMPLETED.
     */
    @Transactional
    public void recordSent(ScheduledReport sr) {
        sr.setSendCount(sr.getSendCount() + 1);
        sr.setLastSentAt(Instant.now());

        boolean completed = false;

        if ("ONE_TIME".equalsIgnoreCase(sr.getScheduleType())) {
            completed = true;
        } else {
            // Check end conditions
            if ("AFTER_N".equalsIgnoreCase(sr.getEndType()) && sr.getEndAfterCount() != null) {
                if (sr.getSendCount() >= sr.getEndAfterCount()) {
                    completed = true;
                }
            } else if ("UNTIL_DATE".equalsIgnoreCase(sr.getEndType()) && sr.getEndDate() != null) {
                if (LocalDate.now().isAfter(sr.getEndDate())) {
                    completed = true;
                }
            }
        }

        if (completed) {
            sr.setStatus("COMPLETED");
            sr.setNextSendAt(null);
        } else {
            Instant next = computeNextSendAt(sr, Instant.now());
            sr.setNextSendAt(next);
        }

        repo.save(sr);
    }

    // ── nextSendAt computation ────────────────────────────────────────────────

    /**
     * Computes the next Instant at which this report should fire, in UTC.
     * @param sr    The report configuration
     * @param after If non-null, compute the next slot strictly after this instant
     *              (used after a send has occurred). If null, compute from config dates.
     */
    public Instant computeNextSendAt(ScheduledReport sr, Instant after) {
        try {
            LocalTime time = LocalTime.parse(sr.getSendTime()); // HH:mm
            ZoneId zone    = ZoneId.of(sr.getTimezone() != null ? sr.getTimezone() : "UTC");
            LocalDate baseDate;

            if ("ONE_TIME".equalsIgnoreCase(sr.getScheduleType())) {
                baseDate = sr.getScheduledDate() != null ? sr.getScheduledDate() : LocalDate.now(zone);
                return ZonedDateTime.of(baseDate, time, zone).toInstant();
            }

            // RECURRING — find next date from "after" (or today)
            LocalDate from = (after != null)
                ? LocalDate.ofInstant(after, zone).plusDays(1)
                : LocalDate.now(zone);

            return switch (sr.getFrequency() == null ? "DAILY" : sr.getFrequency().toUpperCase()) {
                case "DAILY"   -> ZonedDateTime.of(from, time, zone).toInstant();
                case "WEEKLY"  -> {
                    int targetDow = sr.getSendDayOfWeek() != null ? sr.getSendDayOfWeek() : DayOfWeek.MONDAY.getValue() % 7;
                    LocalDate d = from;
                    // DayOfWeek: Monday=1…Sunday=7 in Java; our stored 0=Sun…6=Sat
                    int javaDow = targetDow == 0 ? 7 : targetDow;
                    while (d.getDayOfWeek().getValue() != javaDow) { d = d.plusDays(1); }
                    yield ZonedDateTime.of(d, time, zone).toInstant();
                }
                case "MONTHLY" -> {
                    int dom = sr.getSendDayOfMonth() != null ? sr.getSendDayOfMonth() : 1;
                    LocalDate candidate = from.withDayOfMonth(Math.min(dom, from.lengthOfMonth()));
                    if (!candidate.isAfter(from.minusDays(1))) {
                        candidate = candidate.plusMonths(1);
                        candidate = candidate.withDayOfMonth(Math.min(dom, candidate.lengthOfMonth()));
                    }
                    yield ZonedDateTime.of(candidate, time, zone).toInstant();
                }
                case "CUSTOM"  -> {
                    int days = sr.getCustomIntervalDays() != null ? sr.getCustomIntervalDays() : 1;
                    yield ZonedDateTime.of(from.plusDays(days - 1), time, zone).toInstant();
                }
                default -> ZonedDateTime.of(from, time, zone).toInstant();
            };
        } catch (Exception e) {
            log.error("Failed to compute nextSendAt for report {}: {}", sr.getId(), e.getMessage());
            return null;
        }
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    ScheduledReportResponseDTO toDto(ScheduledReport sr) {
        return ScheduledReportResponseDTO.builder()
            .id(sr.getId())
            .projectId(sr.getProjectId())
            .createdByUserId(sr.getCreatedByUserId())
            .format(sr.getFormat())
            .scheduleType(sr.getScheduleType())
            .frequency(sr.getFrequency())
            .customIntervalDays(sr.getCustomIntervalDays())
            .sendTime(sr.getSendTime())
            .sendDayOfWeek(sr.getSendDayOfWeek())
            .sendDayOfMonth(sr.getSendDayOfMonth())
            .scheduledDate(sr.getScheduledDate() != null ? sr.getScheduledDate().toString() : null)
            .timezone(sr.getTimezone() != null ? sr.getTimezone() : "UTC")
            .recipientsTo(splitEmails(sr.getRecipientsTo()))
            .recipientsCc(splitEmails(sr.getRecipientsCc()))
            .recipientsBcc(splitEmails(sr.getRecipientsBcc()))
            .subject(sr.getSubject())
            .bodyMessage(sr.getBodyMessage())
            .endType(sr.getEndType())
            .endAfterCount(sr.getEndAfterCount())
            .endDate(sr.getEndDate() != null ? sr.getEndDate().toString() : null)
            .sendCount(sr.getSendCount())
            .status(sr.getStatus())
            .nextSendAt(sr.getNextSendAt() != null ? sr.getNextSendAt().toString() : null)
            .lastSentAt(sr.getLastSentAt() != null ? sr.getLastSentAt().toString() : null)
            .createdAt(sr.getCreatedAt() != null ? sr.getCreatedAt().toString() : null)
            .build();
    }

    private List<String> splitEmails(String csv) {
        if (csv == null || csv.isBlank()) return Collections.emptyList();
        return Arrays.stream(csv.split(","))
                     .map(String::trim)
                     .filter(s -> !s.isBlank())
                     .collect(Collectors.toList());
    }
}
