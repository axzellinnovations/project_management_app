package com.planora.backend.service;

import com.planora.backend.model.Project;
import com.planora.backend.model.ProjectType;
import com.planora.backend.model.Task;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.NotificationRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.TeamRepository;
import com.planora.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "notifications.due-date-reminder.enabled=true")
@Transactional
class TaskDueDateReminderServiceIntegrationTest {

    @Autowired
    private TaskDueDateReminderService reminderService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private TeamMemberRepository teamMemberRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @MockBean
    private SimpMessagingTemplate messagingTemplate;

    @Test
    void sendDueDateReminders_createsExpectedNotificationsAndPreventsSameDayDuplicates() {
        User owner = saveUser("owner", "owner@example.com", true);
        User assignee = saveUser("assignee", "assignee@example.com", true);
        User disabled = saveUser("disabled", "disabled@example.com", false);

        Team team = new Team();
        team.setName("team-reminders");
        team.setOwner(owner);
        team = teamRepository.save(team);

        TeamMember assigneeMember = saveTeamMember(team, assignee, TeamRole.MEMBER);
        TeamMember disabledMember = saveTeamMember(team, disabled, TeamRole.MEMBER);

        Project project = new Project();
        project.setName("Reminder Project");
        project.setProjectKey("REM-1");
        project.setOwner(owner);
        project.setType(ProjectType.AGILE);
        project.setTeam(team);
        project = projectRepository.save(project);

        LocalDate today = LocalDate.now(java.time.ZoneId.of("UTC"));

        saveTask(project, assigneeMember, "Due soon task", "TODO", today.plusDays(1));
        saveTask(project, assigneeMember, "Overdue task", "TODO", today.minusDays(4));
        saveTask(project, assigneeMember, "Off cadence overdue", "TODO", today.minusDays(2));
        saveTask(project, disabledMember, "Disabled assignee due soon", "TODO", today.plusDays(1));
        saveTask(project, assigneeMember, "Done task", "DONE", today.plusDays(1));
        saveTask(project, assigneeMember, "No due date", "TODO", null);

        reminderService.sendDueDateReminders();
        long firstRunCount = notificationRepository.count();

        assertEquals(5L, firstRunCount);
        assertEquals(3L, notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(owner.getUserId()).size());
        assertEquals(2L, notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(assignee.getUserId()).size());
        assertEquals(0L, notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(disabled.getUserId()).size());

        reminderService.sendDueDateReminders();
        long secondRunCount = notificationRepository.count();

        assertEquals(firstRunCount, secondRunCount);
    }

    private User saveUser(String username, String email, boolean remindersEnabled) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword("password123");
        user.setNotifyDueDateReminders(remindersEnabled);
        return userRepository.save(user);
    }

    private TeamMember saveTeamMember(Team team, User user, TeamRole role) {
        TeamMember member = new TeamMember();
        member.setTeam(team);
        member.setUser(user);
        member.setRole(role);
        return teamMemberRepository.save(member);
    }

    private Task saveTask(Project project, TeamMember assignee, String title, String status, LocalDate dueDate) {
        Task task = new Task();
        task.setTitle(title);
        task.setProject(project);
        task.setAssignee(assignee);
        task.getAssignees().add(assignee);
        task.setStatus(status);
        task.setDueDate(dueDate);
        task.setReporter(assignee);
        return taskRepository.save(task);
    }
}
