package com.planora.backend.service;

import com.planora.backend.dto.SprintcolumnDTO;
import com.planora.backend.exception.ConflictException;
import com.planora.backend.model.Project;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.SprintStatus;
import com.planora.backend.model.Sprintboard;
import com.planora.backend.model.Sprintcolumn;
import com.planora.backend.model.Task;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.SprintboardRepository;
import com.planora.backend.repository.SpringcolumnRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SprintboardServiceTest {

    @Mock private SprintboardRepository sprintboardRepository;
    @Mock private SpringcolumnRepository springcolumnRepository;
    @Mock private SprintRepository sprintRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private ProjectRepository projectRepository;
    @Mock private TeamMemberRepository teamMemberRepository;
    @Mock private UserRepository userRepository;
    @Mock private SpringcolumnService springcolumnService;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private SprintboardService sprintboardService;

    // -------- helpers --------

    private static Project makeProject() {
        Team team = new Team();
        team.setId(10L);
        Project project = new Project();
        project.setId(3L);
        project.setTeam(team);
        return project;
    }

    private static Sprint makeSprint(Project project) {
        Sprint sprint = new Sprint();
        sprint.setId(5L);
        sprint.setProject(project);
        return sprint;
    }

    private static Sprintboard makeSprintboard(Sprint sprint) {
        Sprintboard sb = new Sprintboard();
        sb.setId(7L);
        sb.setSprint(sprint);
        return sb;
    }

    // -------- existing tests (updated for BUG-6) --------

    @Test
    void moveTaskToColumn_statusChangeNotifiesStakeholders() {
        Project project = makeProject();
        Sprint sprint = makeSprint(project);
        Sprintboard sprintboard = makeSprintboard(sprint);

        User assigneeUser = new User();
        assigneeUser.setUserId(200L);
        assigneeUser.setUsername("assignee");

        TeamMember assignee = new TeamMember();
        assignee.setUser(assigneeUser);

        User reporterUser = new User();
        reporterUser.setUserId(300L);
        reporterUser.setUsername("reporter");

        TeamMember reporter = new TeamMember();
        reporter.setUser(reporterUser);

        Task task = new Task();
        task.setId(77L);
        task.setTitle("Backend migration");
        task.setSprint(sprint);
        task.setStatus("TODO");
        task.setAssignee(assignee);
        task.setReporter(reporter);

        User actor = new User();
        actor.setUserId(500L);
        actor.setUsername("actor");

        TeamMember actorMember = new TeamMember();
        actorMember.setRole(TeamRole.MEMBER);

        when(sprintboardRepository.findById(7L)).thenReturn(Optional.of(sprintboard));
        when(projectRepository.findById(3L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(10L, 500L)).thenReturn(Optional.of(actorMember));
        when(taskRepository.findById(77L)).thenReturn(Optional.of(task));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findById(500L)).thenReturn(Optional.of(actor));
        when(userRepository.findAllById(any())).thenReturn(List.of(assigneeUser, reporterUser));

        sprintboardService.moveTaskToColumn(77L, 7L, "DONE", 500L);

        verify(notificationService, times(2))
                .createNotification(any(User.class), contains("moved task"), eq("/taskcard?taskId=77"));
    }

    @Test
    void moveTaskToColumn_sameStatusDoesNotNotify() {
        Project project = makeProject();
        Sprint sprint = makeSprint(project);
        Sprintboard sprintboard = makeSprintboard(sprint);

        Task task = new Task();
        task.setId(77L);
        task.setTitle("Backend migration");
        task.setSprint(sprint);
        task.setStatus("TODO");

        TeamMember actorMember = new TeamMember();
        actorMember.setRole(TeamRole.MEMBER);

        when(sprintboardRepository.findById(7L)).thenReturn(Optional.of(sprintboard));
        when(projectRepository.findById(3L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(10L, 500L)).thenReturn(Optional.of(actorMember));
        when(taskRepository.findById(77L)).thenReturn(Optional.of(task));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        sprintboardService.moveTaskToColumn(77L, 7L, "TODO", 500L);

        verify(notificationService, never()).createNotification(any(User.class), any(String.class), any(String.class));
    }

    // -------- new tests --------

    @Test
    void addColumnToSprintboard_createsColumnWithMaxPositionPlusOne() {
        Project project = makeProject();
        Sprint sprint = makeSprint(project);
        Sprintboard sprintboard = makeSprintboard(sprint);

        Sprintcolumn existingCol = new Sprintcolumn();
        existingCol.setPosition(2);

        TeamMember adminMember = new TeamMember();
        adminMember.setRole(TeamRole.ADMIN);

        when(sprintboardRepository.findById(7L)).thenReturn(Optional.of(sprintboard));
        when(projectRepository.findById(3L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(10L, 100L)).thenReturn(Optional.of(adminMember));
        when(springcolumnRepository.findBySprintboardIdOrderByPosition(7L)).thenReturn(List.of(existingCol));
        when(springcolumnRepository.save(any(Sprintcolumn.class))).thenAnswer(inv -> {
            Sprintcolumn col = inv.getArgument(0);
            col.setId(99L);
            return col;
        });

        SprintcolumnDTO result = sprintboardService.addColumnToSprintboard(7L, "Review", "TODO", 100L);

        org.junit.jupiter.api.Assertions.assertEquals(3, result.getPosition());
        org.junit.jupiter.api.Assertions.assertEquals("Review", result.getColumnName());
    }

    @Test
    void completeSprint_whenNotActive_throwsConflict() {
        Project project = makeProject();
        Sprint sprint = makeSprint(project);
        sprint.setStatus(SprintStatus.NOT_STARTED);

        SprintService sprintSvc = new SprintService(
                sprintRepository, projectRepository, teamMemberRepository,
                sprintboardService, taskRepository, sprintboardRepository);

        when(sprintRepository.findById(5L)).thenReturn(Optional.of(sprint));

        org.junit.jupiter.api.Assertions.assertThrows(
                ConflictException.class,
                () -> sprintSvc.completeSprint(5L, 100L)
        );
    }
}
