package com.planora.backend.service;

import com.planora.backend.configuration.DueDateReminderProperties;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DueDateReminderScheduler {

    private static final Logger logger = LoggerFactory.getLogger(DueDateReminderScheduler.class);

    private final DueDateReminderProperties reminderProperties;
    private final TaskDueDateReminderService reminderService;

    @Scheduled(
            cron = "${notifications.due-date-reminder.cron:0 0 12 * * *}",
            zone = "${notifications.due-date-reminder.timezone:UTC}"
    )
    public void dispatchDueDateReminders() {
        if (!reminderProperties.isEnabled()) {
            logger.debug("DueDateReminderScheduler: reminders are disabled.");
            return;
        }

        TaskDueDateReminderService.ReminderRunStats stats = reminderService.sendDueDateReminders();
        logger.info(
                "DueDateReminderScheduler: scannedTasks={}, sent={}, dueSoon={}, overdue={}, skippedIneligible={}, skippedDisabled={}, skippedDuplicate={}",
                stats.getScannedTasks(),
                stats.getSentNotifications(),
                stats.getSentDueSoonNotifications(),
                stats.getSentOverdueNotifications(),
                stats.getSkippedIneligibleTasks(),
                stats.getSkippedDisabledRecipients(),
                stats.getSkippedDuplicateNotifications()
        );
    }
}
