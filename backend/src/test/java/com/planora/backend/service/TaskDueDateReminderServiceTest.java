package com.planora.backend.service;

import com.planora.backend.configuration.DueDateReminderProperties;
import com.planora.backend.model.Project;
import com.planora.backend.model.ProjectType;
import com.planora.backend.model.Task;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.User;
import com.planora.backend.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskDueDateReminderServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private NotificationService notificationService;

    private DueDateReminderProperties properties;
    private TaskDueDateReminderService reminderService;

    private User owner;
    private User assigneeUser;

    @BeforeEach
    void setUp() {
        properties = new DueDateReminderProperties();
        properties.setEnabled(true);
        properties.setTimezone("UTC");
        properties.setDueSoonDays(List.of(7, 1));
        properties.setOverdueFirstDay(1);
        properties.setOverdueIntervalDays(3);

        reminderService = new TaskDueDateReminderService(taskRepository, notificationService, properties);

        owner = new User();
        owner.setUserId(1L);
        owner.setUsername("owner");
        owner.setNotifyDueDateReminders(true);

        assigneeUser = new User();
        assigneeUser.setUserId(2L);
        assigneeUser.setUsername("assignee");
        assigneeUser.setNotifyDueDateReminders(true);
    }

    @Test
    void sendDueDateReminders_sendsSevenDayReminderToAssigneeAndOwner() {
        LocalDate today = LocalDate.now(properties.zoneId());
        Task task = buildTask(101L, today.plusDays(7), "TODO", owner, assigneeUser);

        when(taskRepository.findOpenTasksDueOnOrBeforeWithReminderRelations(today.plusDays(7)))
                .thenReturn(List.of(task));
        when(notificationService.createNotificationIfNotDuplicateSince(any(), anyString(), anyString(), any(LocalDateTime.class)))
                .thenReturn(true);

        TaskDueDateReminderService.ReminderRunStats stats = reminderService.sendDueDateReminders();

        assertEquals(1, stats.getScannedTasks());
        assertEquals(2, stats.getSentNotifications());
        assertEquals(2, stats.getSentDueSoonNotifications());
        assertEquals(0, stats.getSentOverdueNotifications());

        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(notificationService, times(2)).createNotificationIfNotDuplicateSince(
                any(User.class),
                messageCaptor.capture(),
                eq("/taskcard?taskId=101"),
                eq(today.atStartOfDay())
        );
        assertTrue(messageCaptor.getAllValues().stream().allMatch(msg -> msg.contains("due in 7 days")));
    }

    @Test
    void sendDueDateReminders_sendsOverdueOnConfiguredCadence() {
        LocalDate today = LocalDate.now(properties.zoneId());
        Task task = buildTask(102L, today.minusDays(4), "IN_PROGRESS", owner, assigneeUser);

        when(taskRepository.findOpenTasksDueOnOrBeforeWithReminderRelations(today.plusDays(7)))
                .thenReturn(List.of(task));
        when(notificationService.createNotificationIfNotDuplicateSince(any(), anyString(), anyString(), any(LocalDateTime.class)))
                .thenReturn(true);

        TaskDueDateReminderService.ReminderRunStats stats = reminderService.sendDueDateReminders();

        assertEquals(2, stats.getSentNotifications());
        assertEquals(0, stats.getSentDueSoonNotifications());
        assertEquals(2, stats.getSentOverdueNotifications());

        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(notificationService, times(2)).createNotificationIfNotDuplicateSince(
                any(User.class),
                messageCaptor.capture(),
                eq("/taskcard?taskId=102"),
                eq(today.atStartOfDay())
        );
        assertTrue(messageCaptor.getAllValues().stream().allMatch(msg -> msg.contains("overdue by 4 days")));
    }

    @Test
    void sendDueDateReminders_skipsOffCadenceAndRespectsPreferenceToggle() {
        LocalDate today = LocalDate.now(properties.zoneId());

        User disabledAssignee = new User();
        disabledAssignee.setUserId(3L);
        disabledAssignee.setUsername("disabled");
        disabledAssignee.setNotifyDueDateReminders(false);

        Task offCadenceTask = buildTask(103L, today.minusDays(2), "TODO", owner, assigneeUser);
        Task oneDaySoonTask = buildTask(104L, today.plusDays(1), "TODO", owner, disabledAssignee);

        when(taskRepository.findOpenTasksDueOnOrBeforeWithReminderRelations(today.plusDays(7)))
                .thenReturn(List.of(offCadenceTask, oneDaySoonTask));
        when(notificationService.createNotificationIfNotDuplicateSince(any(), anyString(), anyString(), any(LocalDateTime.class)))
                .thenReturn(true);

        TaskDueDateReminderService.ReminderRunStats stats = reminderService.sendDueDateReminders();

        assertEquals(2, stats.getScannedTasks());
        assertEquals(1, stats.getSentNotifications());
        assertEquals(1, stats.getSentDueSoonNotifications());
        assertEquals(1, stats.getSkippedDisabledRecipients());

        verify(notificationService, times(1)).createNotificationIfNotDuplicateSince(
                eq(owner),
                anyString(),
                eq("/taskcard?taskId=104"),
                eq(today.atStartOfDay())
        );
        verify(notificationService, never()).createNotificationIfNotDuplicateSince(
                eq(disabledAssignee),
                anyString(),
                anyString(),
                any(LocalDateTime.class)
        );
    }

    @Test
    void sendDueDateReminders_skipsDuplicateRecipientsWhenOwnerAlsoAssignee() {
        LocalDate today = LocalDate.now(properties.zoneId());
        Task task = buildTask(105L, today.plusDays(1), "TODO", owner, owner);

        when(taskRepository.findOpenTasksDueOnOrBeforeWithReminderRelations(today.plusDays(7)))
                .thenReturn(List.of(task));
        when(notificationService.createNotificationIfNotDuplicateSince(any(), anyString(), anyString(), any(LocalDateTime.class)))
                .thenReturn(true);

        TaskDueDateReminderService.ReminderRunStats stats = reminderService.sendDueDateReminders();

        assertEquals(1, stats.getSentNotifications());
        verify(notificationService, times(1)).createNotificationIfNotDuplicateSince(
                eq(owner),
                anyString(),
                eq("/taskcard?taskId=105"),
                eq(today.atStartOfDay())
        );
    }

    @Test
    void sendDueDateReminders_countsDuplicateSkips() {
        LocalDate today = LocalDate.now(properties.zoneId());
        Task task = buildTask(106L, today.plusDays(1), "TODO", owner, assigneeUser);

        when(taskRepository.findOpenTasksDueOnOrBeforeWithReminderRelations(today.plusDays(7)))
                .thenReturn(List.of(task));
        when(notificationService.createNotificationIfNotDuplicateSince(any(), anyString(), anyString(), any(LocalDateTime.class)))
                .thenReturn(false);

        TaskDueDateReminderService.ReminderRunStats stats = reminderService.sendDueDateReminders();

        assertEquals(0, stats.getSentNotifications());
        assertEquals(2, stats.getSkippedDuplicateNotifications());
    }

    private Task buildTask(Long id, LocalDate dueDate, String status, User ownerUser, User assignee) {
        Project project = new Project();
        project.setId(10L);
        project.setName("Planora");
        project.setType(ProjectType.AGILE);
        project.setOwner(ownerUser);

        TeamMember assigneeMember = new TeamMember();
        assigneeMember.setId(50L + id);
        assigneeMember.setUser(assignee);

        Task task = new Task();
        task.setId(id);
        task.setTitle("Task-" + id);
        task.setProject(project);
        task.setStatus(status);
        task.setDueDate(dueDate);
        task.setAssignee(assigneeMember);
        task.getAssignees().add(assigneeMember);
        return task;
    }
}
