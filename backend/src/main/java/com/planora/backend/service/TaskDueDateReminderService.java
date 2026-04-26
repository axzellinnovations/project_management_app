// Service layer for calculating and dispatching task due date and overdue notifications.
package com.planora.backend.service;

import com.planora.backend.configuration.DueDateReminderProperties;
import com.planora.backend.model.Task;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.User;
import com.planora.backend.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TaskDueDateReminderService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;

    private final TaskRepository taskRepository;
    private final NotificationService notificationService;
    private final DueDateReminderProperties reminderProperties;

    // =====================================================
    // TASK REMINDER DISPATCH
    // =====================================================

    // Orchestrates the process of finding eligible tasks and sending reminder notifications.
    @Transactional
    public ReminderRunStats sendDueDateReminders() {
        if (!reminderProperties.isEnabled()) {
            return ReminderRunStats.builder().disabled(true).build();
        }

        ZoneId zoneId = reminderProperties.zoneId();
        LocalDate today = LocalDate.now(zoneId);
        List<Integer> dueSoonDays = reminderProperties.normalizedDueSoonDays();

        int maxDueSoon = dueSoonDays.stream().mapToInt(Integer::intValue).max().orElse(0);
        LocalDate maxDueDate = today.plusDays(maxDueSoon);

        List<Task> candidates = taskRepository.findOpenTasksDueOnOrBeforeWithReminderRelations(maxDueDate);

        ReminderRunStats.ReminderRunStatsBuilder stats = ReminderRunStats.builder()
                .scannedTasks(candidates.size());

        LocalDateTime dedupeWindowStart = today.atStartOfDay();

        for (Task task : candidates) {
            if (task.getDueDate() == null || isDone(task)) {
                stats.skippedIneligibleTasks(stats.peekSkippedIneligibleTasks() + 1);
                continue;
            }

            ReminderMessage reminderMessage = buildReminderMessage(task, today, dueSoonDays);
            if (reminderMessage == null) {
                continue;
            }

            Map<Long, User> recipients = resolveRecipients(task);
            if (recipients.isEmpty()) {
                continue;
            }

            String link = "/taskcard?taskId=" + task.getId();
            for (User recipient : recipients.values()) {
                if (!recipient.isNotifyDueDateReminders()) {
                    stats.skippedDisabledRecipients(stats.peekSkippedDisabledRecipients() + 1);
                    continue;
                }

                boolean created = notificationService.createNotificationIfNotDuplicateSince(
                        recipient,
                        reminderMessage.message(),
                        link,
                        dedupeWindowStart
                );
                if (created) {
                    stats.sentNotifications(stats.peekSentNotifications() + 1);
                    if (reminderMessage.type() == ReminderType.DUE_SOON) {
                        stats.sentDueSoonNotifications(stats.peekSentDueSoonNotifications() + 1);
                    } else {
                        stats.sentOverdueNotifications(stats.peekSentOverdueNotifications() + 1);
                    }
                } else {
                    stats.skippedDuplicateNotifications(stats.peekSkippedDuplicateNotifications() + 1);
                }
            }
        }

        return stats.build();
    }

    // =====================================================
    // MESSAGE & RECIPIENT RESOLUTION
    // =====================================================

    // Constructs the appropriate reminder message text based on the due date delta.
    private ReminderMessage buildReminderMessage(Task task, LocalDate today, List<Integer> dueSoonDays) {
        long dayDelta = ChronoUnit.DAYS.between(today, task.getDueDate());
        if (dayDelta > 0 && dueSoonDays.contains((int) dayDelta)) {
            String dayLabel = dayDelta == 1 ? "day" : "days";
            String message = "Task \"" + task.getTitle() + "\" is due in " + dayDelta + " " + dayLabel +
                    " on " + DATE_FORMAT.format(task.getDueDate()) + ".";
            return new ReminderMessage(message, ReminderType.DUE_SOON);
        }

        if (dayDelta < 0) {
            int daysOverdue = (int) Math.abs(dayDelta);
            if (shouldSendOverdue(daysOverdue)) {
                String dayLabel = daysOverdue == 1 ? "day" : "days";
                String message = "Task \"" + task.getTitle() + "\" is overdue by " + daysOverdue + " " + dayLabel +
                        " (was due on " + DATE_FORMAT.format(task.getDueDate()) + ").";
                return new ReminderMessage(message, ReminderType.OVERDUE);
            }
        }

        return null;
    }

    // Determines if an overdue notification should be sent based on configured intervals.
    private boolean shouldSendOverdue(int daysOverdue) {
        int firstDay = reminderProperties.getOverdueFirstDay();
        int interval = reminderProperties.getOverdueIntervalDays();
        if (daysOverdue < firstDay) {
            return false;
        }
        return (daysOverdue - firstDay) % interval == 0;
    }

    // Checks if a task is already completed.
    private boolean isDone(Task task) {
        return task.getStatus() != null && "DONE".equalsIgnoreCase(task.getStatus());
    }

    // Gathers all unique users (owner, assignee, co-assignees) who should receive the reminder.
    private Map<Long, User> resolveRecipients(Task task) {
        Map<Long, User> recipients = new LinkedHashMap<>();

        addRecipient(recipients, task.getProject() != null ? task.getProject().getOwner() : null);

        if (task.getAssignee() != null) {
            addRecipient(recipients, task.getAssignee().getUser());
        }

        for (TeamMember member : task.getAssignees()) {
            addRecipient(recipients, member != null ? member.getUser() : null);
        }

        return recipients;
    }

    private void addRecipient(Map<Long, User> recipients, User candidate) {
        if (candidate == null || candidate.getUserId() == null) {
            return;
        }
        recipients.put(candidate.getUserId(), candidate);
    }

    private record ReminderMessage(String message, ReminderType type) {
    }

    private enum ReminderType {
        DUE_SOON,
        OVERDUE
    }

    // =====================================================
    // STATISTICS TRACKING
    // =====================================================

    // Container for recording the results of a reminder run.
    public static class ReminderRunStats {
        private final boolean disabled;
        private final int scannedTasks;
        private final int sentNotifications;
        private final int sentDueSoonNotifications;
        private final int sentOverdueNotifications;
        private final int skippedIneligibleTasks;
        private final int skippedDisabledRecipients;
        private final int skippedDuplicateNotifications;

        private ReminderRunStats(ReminderRunStatsBuilder builder) {
            this.disabled = builder.disabled;
            this.scannedTasks = builder.scannedTasks;
            this.sentNotifications = builder.sentNotifications;
            this.sentDueSoonNotifications = builder.sentDueSoonNotifications;
            this.sentOverdueNotifications = builder.sentOverdueNotifications;
            this.skippedIneligibleTasks = builder.skippedIneligibleTasks;
            this.skippedDisabledRecipients = builder.skippedDisabledRecipients;
            this.skippedDuplicateNotifications = builder.skippedDuplicateNotifications;
        }

        public boolean isDisabled() {
            return disabled;
        }

        public int getScannedTasks() {
            return scannedTasks;
        }

        public int getSentNotifications() {
            return sentNotifications;
        }

        public int getSentDueSoonNotifications() {
            return sentDueSoonNotifications;
        }

        public int getSentOverdueNotifications() {
            return sentOverdueNotifications;
        }

        public int getSkippedIneligibleTasks() {
            return skippedIneligibleTasks;
        }

        public int getSkippedDisabledRecipients() {
            return skippedDisabledRecipients;
        }

        public int getSkippedDuplicateNotifications() {
            return skippedDuplicateNotifications;
        }

        public static ReminderRunStatsBuilder builder() {
            return new ReminderRunStatsBuilder();
        }

        public static class ReminderRunStatsBuilder {
            private boolean disabled;
            private int scannedTasks;
            private int sentNotifications;
            private int sentDueSoonNotifications;
            private int sentOverdueNotifications;
            private int skippedIneligibleTasks;
            private int skippedDisabledRecipients;
            private int skippedDuplicateNotifications;

            public ReminderRunStatsBuilder disabled(boolean disabled) {
                this.disabled = disabled;
                return this;
            }

            public ReminderRunStatsBuilder scannedTasks(int scannedTasks) {
                this.scannedTasks = scannedTasks;
                return this;
            }

            public ReminderRunStatsBuilder sentNotifications(int sentNotifications) {
                this.sentNotifications = sentNotifications;
                return this;
            }

            public ReminderRunStatsBuilder sentDueSoonNotifications(int sentDueSoonNotifications) {
                this.sentDueSoonNotifications = sentDueSoonNotifications;
                return this;
            }

            public ReminderRunStatsBuilder sentOverdueNotifications(int sentOverdueNotifications) {
                this.sentOverdueNotifications = sentOverdueNotifications;
                return this;
            }

            public ReminderRunStatsBuilder skippedIneligibleTasks(int skippedIneligibleTasks) {
                this.skippedIneligibleTasks = skippedIneligibleTasks;
                return this;
            }

            public ReminderRunStatsBuilder skippedDisabledRecipients(int skippedDisabledRecipients) {
                this.skippedDisabledRecipients = skippedDisabledRecipients;
                return this;
            }

            public ReminderRunStatsBuilder skippedDuplicateNotifications(int skippedDuplicateNotifications) {
                this.skippedDuplicateNotifications = skippedDuplicateNotifications;
                return this;
            }

            public int peekSentNotifications() {
                return sentNotifications;
            }

            public int peekSentDueSoonNotifications() {
                return sentDueSoonNotifications;
            }

            public int peekSentOverdueNotifications() {
                return sentOverdueNotifications;
            }

            public int peekSkippedIneligibleTasks() {
                return skippedIneligibleTasks;
            }

            public int peekSkippedDisabledRecipients() {
                return skippedDisabledRecipients;
            }

            public int peekSkippedDuplicateNotifications() {
                return skippedDuplicateNotifications;
            }

            public ReminderRunStats build() {
                return new ReminderRunStats(this);
            }
        }
    }
}
