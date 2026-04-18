package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * Response DTO for a scheduled report configuration.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduledReportResponseDTO {

    private Long   id;
    private Long   projectId;
    private Long   createdByUserId;
    private String format;
    private String scheduleType;

    // Recurrence
    private String  frequency;
    private Integer customIntervalDays;
    private String  sendTime;
    private Integer sendDayOfWeek;
    private Integer sendDayOfMonth;
    private String  scheduledDate;

    // Recipients
    private List<String> recipientsTo;
    private List<String> recipientsCc;
    private List<String> recipientsBcc;

    // Email content
    private String subject;
    private String bodyMessage;

    // End condition
    private String  endType;
    private Integer endAfterCount;
    private String  endDate;

    // Runtime
    private int    sendCount;
    private String status;
    private String nextSendAt;
    private String lastSentAt;
    private String createdAt;
}
