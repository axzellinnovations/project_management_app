package com.planora.backend.service;

import com.planora.backend.dto.CommentRequestDTO;
import com.planora.backend.dto.TaskRequestDTO;
import com.planora.backend.dto.TaskResponseDTO;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.Comment;
import com.planora.backend.model.Priority;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.CommentRepository;
import com.planora.backend.repository.LabelRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TaskAccessRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private TeamMemberRepository teamMemberRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private LabelRepository labelRepository;
    @Mock
    private CommentRepository commentRepository;
    @Mock
    private SprintRepository sprintRepository;
    @Mock
    private TaskAccessRepository taskAccessRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private TaskActivityService taskActivityService;

    @InjectMocks
    private TaskService taskService;

    private Project project;
    private Team team;
    private User creatorUser;
    private User assigneeUser;
    private User actorUser;
    private TeamMember creator;
    private TeamMember assignee;
    private TeamMember actorMember;

    @BeforeEach
    void setUp() {
        team = new Team();
        team.setId(20L);

        project = new Project();
        project.setId(10L);
        project.setName("Planora");
        project.setTeam(team);

        creatorUser = new User();
        creatorUser.setUserId(100L);
        creatorUser.setUsername("creator");

        creator = new TeamMember();
        creator.setId(1L);
        creator.setRole(TeamRole.MEMBER);
        creator.setUser(creatorUser);
        creator.setTeam(team);

        assigneeUser = new User();
        assigneeUser.setUserId(200L);
        assigneeUser.setUsername("assignee");

        assignee = new TeamMember();
        assignee.setId(2L);
        assignee.setRole(TeamRole.MEMBER);
        assignee.setUser(assigneeUser);
        assignee.setTeam(team);

        actorUser = new User();
        actorUser.setUserId(500L);
        actorUser.setUsername("actor");

        actorMember = new TeamMember();
        actorMember.setId(3L);
        actorMember.setRole(TeamRole.MEMBER);
        actorMember.setUser(actorUser);
        actorMember.setTeam(team);
    }

    private Task buildTask(Long taskId) {
        Task task = new Task();
        task.setId(taskId);
        task.setTitle("Build tests");
        task.setProject(project);
        task.setReporter(creator);
        task.setAssignee(assignee);
        task.setStatus("TODO");
        task.setPriority(Priority.MEDIUM);
        return task;
    }

    @Test
    void createTask_setsDefaultDatesAndNotifiesAssignee() {
        TaskRequestDTO request = new TaskRequestDTO();
        request.setProjectId(10L);
        request.setTitle("Build tests");
        request.setDescription("Cover backend service");
        request.setStatus("TODO");
        request.setAssigneeId(200L);

        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 100L)).thenReturn(Optional.of(creator));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 200L)).thenReturn(Optional.of(assignee));
        when(userRepository.findById(100L)).thenReturn(Optional.of(creator.getUser()));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> {
            Task saved = invocation.getArgument(0);
            saved.setId(999L);
            return saved;
        });

        TaskResponseDTO result = taskService.createTask(request, 100L);

        assertEquals(999L, result.getId());
        assertEquals("Build tests", result.getTitle());
        assertEquals(LocalDate.now(), result.getStartDate());
        assertEquals(LocalDate.now(), result.getDueDate());
        assertEquals(0, result.getStoryPoint());
        verify(notificationService).createNotification(
                assignee.getUser(),
                "You were assigned to a new task: Build tests",
                "/taskcard?taskId=999"
        );
    }

    @Test
    void createTask_viewerCannotCreate() {
        TeamMember viewer = new TeamMember();
        viewer.setRole(TeamRole.VIEWER);

        TaskRequestDTO request = new TaskRequestDTO();
        request.setProjectId(10L);
        request.setTitle("Blocked task");

        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 100L)).thenReturn(Optional.of(viewer));

        ForbiddenException exception = assertThrows(ForbiddenException.class, () -> taskService.createTask(request, 100L));

        assertEquals("Insufficient permissions: requires MEMBER or higher", exception.getMessage());
        verify(taskRepository, never()).save(any(Task.class));
        verify(notificationService, never()).createNotification(any(), any(), any());
    }

    @Test
    void updateTask_statusChangeNotifiesStakeholders() {
        Task task = buildTask(50L);
        TaskRequestDTO request = new TaskRequestDTO();
        request.setStatus("DONE");

        when(taskRepository.findById(50L)).thenReturn(Optional.of(task));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 500L)).thenReturn(Optional.of(actorMember));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findById(500L)).thenReturn(Optional.of(actorUser));
        when(userRepository.findAllById(any())).thenReturn(List.of(creatorUser, assigneeUser));

        TaskResponseDTO result = taskService.updateTask(50L, request, 500L);

        assertEquals("DONE", result.getStatus());
        verify(taskActivityService).logActivity(eq(50L), any(), eq("actor"), contains("Status changed from TODO to DONE"));
        verify(notificationService, times(2)).createNotification(any(User.class), contains("changed task status"), eq("/taskcard?taskId=50"));
    }

    @Test
    void updatePriority_notifiesStakeholdersWhenPriorityChanges() {
        Task task = buildTask(51L);
        task.setPriority(Priority.LOW);

        when(taskRepository.findById(51L)).thenReturn(Optional.of(task));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 500L)).thenReturn(Optional.of(actorMember));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findById(500L)).thenReturn(Optional.of(actorUser));
        when(userRepository.findAllById(any())).thenReturn(List.of(creatorUser, assigneeUser));

        TaskResponseDTO result = taskService.updatePriority(51L, "HIGH", 500L);

        assertEquals("HIGH", result.getPriority());
        verify(taskActivityService).logActivity(eq(51L), any(), eq("actor"), contains("Priority changed from LOW to HIGH"));
        verify(notificationService, times(2)).createNotification(any(User.class), contains("changed task priority"), eq("/taskcard?taskId=51"));
    }

    @Test
    void deleteTask_ownerDeleteNotifiesStakeholders() {
        Task task = buildTask(60L);
        actorMember.setRole(TeamRole.OWNER);

        when(taskRepository.findById(60L)).thenReturn(Optional.of(task));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 500L)).thenReturn(Optional.of(actorMember));
        when(userRepository.findById(500L)).thenReturn(Optional.of(actorUser));
        when(userRepository.findAllById(any())).thenReturn(List.of(creatorUser, assigneeUser));

        taskService.deleteTask(60L, 500L);

        verify(notificationService, times(2)).createNotification(any(User.class), contains("deleted task"), eq("/kanban?projectId=10"));
        verify(taskRepository).delete(task);
    }

    @Test
    void assignUser_notifiesWhenAssigneeIsDifferentFromActor() {
        Task task = buildTask(70L);

        when(taskRepository.findById(70L)).thenReturn(Optional.of(task));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 500L)).thenReturn(Optional.of(actorMember));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 200L)).thenReturn(Optional.of(assignee));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findById(500L)).thenReturn(Optional.of(actorUser));

        taskService.assignUser(70L, 200L, 500L);

        verify(taskRepository).save(task);
        verify(taskActivityService).logActivity(eq(70L), any(), eq("actor"), contains("assigned task to assignee"));
        verify(notificationService).createNotification(
                eq(assigneeUser),
                eq("You were assigned to task: Build tests"),
                eq("/taskcard?taskId=70")
        );
    }

    @Test
    void assignUser_doesNotNotifyWhenActorAssignsSelf() {
        Task task = buildTask(71L);

        when(taskRepository.findById(71L)).thenReturn(Optional.of(task));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 500L)).thenReturn(Optional.of(actorMember));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findById(500L)).thenReturn(Optional.of(actorUser));

        taskService.assignUser(71L, 500L, 500L);

        verify(taskRepository).save(task);
        verify(taskActivityService).logActivity(eq(71L), any(), eq("actor"), contains("assigned task to actor"));
        verify(notificationService, never()).createNotification(any(User.class), any(String.class), any(String.class));
    }

    @Test
    void addComment_notifiesAssigneeAndReporterWhenCommenterIsDifferentUser() {
        Task task = buildTask(80L);
        CommentRequestDTO request = new CommentRequestDTO();
        request.setContent("Looks good, please review.");

        when(taskRepository.findById(80L)).thenReturn(Optional.of(task));
        when(userRepository.findById(500L)).thenReturn(Optional.of(actorUser));
        when(userRepository.findAllById(any())).thenReturn(List.of(assigneeUser, creatorUser));
        when(commentRepository.save(any(Comment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        taskService.addComment(80L, request, 500L);

        verify(commentRepository).save(any(Comment.class));
        verify(taskActivityService).logActivity(eq(80L), any(), eq("actor"), contains("commented:"));
        verify(notificationService).createNotification(
                eq(assigneeUser),
                eq("actor commented on task: Build tests"),
                eq("/taskcard?taskId=80")
        );
        verify(notificationService).createNotification(
                eq(creatorUser),
                eq("actor commented on task: Build tests"),
                eq("/taskcard?taskId=80")
        );
    }

    @Test
    void addComment_notifiesReporterWhenAssigneeIsCommentAuthor() {
        Task task = buildTask(81L);
        task.setAssignee(actorMember);

        CommentRequestDTO request = new CommentRequestDTO();
        request.setContent("Self update");

        when(taskRepository.findById(81L)).thenReturn(Optional.of(task));
        when(userRepository.findById(500L)).thenReturn(Optional.of(actorUser));
        when(userRepository.findAllById(any())).thenReturn(List.of(creatorUser));
        when(commentRepository.save(any(Comment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        taskService.addComment(81L, request, 500L);

        verify(commentRepository).save(any(Comment.class));
        verify(notificationService).createNotification(
                eq(creatorUser),
                eq("actor commented on task: Build tests"),
                eq("/taskcard?taskId=81")
        );
    }

    @Test
    void addComment_deduplicatesWhenAssigneeAndReporterAreSameUser() {
        Task task = buildTask(82L);
        task.setReporter(assignee);

        CommentRequestDTO request = new CommentRequestDTO();
        request.setContent("Ping");

        when(taskRepository.findById(82L)).thenReturn(Optional.of(task));
        when(userRepository.findById(500L)).thenReturn(Optional.of(actorUser));
        when(userRepository.findAllById(any())).thenReturn(List.of(assigneeUser));
        when(commentRepository.save(any(Comment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        taskService.addComment(82L, request, 500L);

        verify(commentRepository).save(any(Comment.class));
        verify(notificationService, times(1)).createNotification(
                eq(assigneeUser),
                eq("actor commented on task: Build tests"),
                eq("/taskcard?taskId=82")
        );
    }

    @Test
    void createTask_setsReporterToCurrentUser() {
        TaskRequestDTO request = new TaskRequestDTO();
        request.setProjectId(10L);
        request.setTitle("Reporter test task");

        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 100L)).thenReturn(Optional.of(creator));
        when(userRepository.findById(100L)).thenReturn(Optional.of(creatorUser));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> {
            Task saved = invocation.getArgument(0);
            saved.setId(1001L);
            return saved;
        });

        TaskResponseDTO result = taskService.createTask(request, 100L);

        assertEquals("creator", result.getReporterName());
    }

    @Test
    void createTask_withInvalidSprintId_throwsResourceNotFoundException() {
        TaskRequestDTO request = new TaskRequestDTO();
        request.setProjectId(10L);
        request.setTitle("Sprint task");
        request.setSprintId(999L);

        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 100L)).thenReturn(Optional.of(creator));
        when(sprintRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> taskService.createTask(request, 100L));
        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    void deleteTask_byNonOwnerNonAdmin_throwsForbiddenException() {
        Task task = buildTask(60L);
        actorMember.setRole(TeamRole.MEMBER);

        when(taskRepository.findById(60L)).thenReturn(Optional.of(task));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 500L)).thenReturn(Optional.of(actorMember));

        ForbiddenException exception = assertThrows(ForbiddenException.class,
                () -> taskService.deleteTask(60L, 500L));

        assertNotNull(exception.getMessage());
        verify(taskRepository, never()).delete(any(Task.class));
    }

    @Test
    void addDependency_toItself_throwsIllegalArgumentException() {
        Task task = buildTask(50L);

        when(taskRepository.findById(50L)).thenReturn(Optional.of(task));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 500L)).thenReturn(Optional.of(actorMember));

        assertThrows(IllegalArgumentException.class,
                () -> taskService.addDependency(50L, 50L, 500L));
    }

    @Test
    void bulkUpdateStatus_crossProject_throwsForbiddenException() {
        // task1 belongs to project (team 20), task2 belongs to a different project (team 99)
        Team otherTeam = new Team();
        otherTeam.setId(99L);
        Project otherProject = new Project();
        otherProject.setId(55L);
        otherProject.setTeam(otherTeam);

        Task task1 = buildTask(101L);
        Task task2 = new Task();
        task2.setId(102L);
        task2.setProject(otherProject);

        // actorMember is member of team 20, but not team 99
        when(taskRepository.findAllById(List.of(101L, 102L))).thenReturn(List.of(task1, task2));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 500L)).thenReturn(Optional.of(actorMember));
        when(teamMemberRepository.findByTeamIdAndUserUserId(99L, 500L)).thenReturn(Optional.empty());
        when(userRepository.findById(500L)).thenReturn(Optional.of(actorUser));

        assertThrows(ForbiddenException.class,
                () -> taskService.bulkUpdateStatus(List.of(101L, 102L), "DONE", 500L));
    }

    @Test
    void updateTask_setsDoneStatus_setsCompletedAt() {
        Task task = buildTask(1L);
        task.setStatus("IN_PROGRESS");

        TaskRequestDTO request = new TaskRequestDTO();
        request.setStatus("DONE");

        when(taskRepository.findById(1L)).thenReturn(Optional.of(task));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 500L)).thenReturn(Optional.of(actorMember));
        when(userRepository.findById(500L)).thenReturn(Optional.of(actorUser));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        taskService.updateTask(1L, request, 500L);

        assertNotNull(task.getCompletedAt(), "completedAt should be set when status transitions to DONE");
    }

    @Test
    void updateTask_movingFromDone_clearsCompletedAt() {
        Task task = buildTask(2L);
        task.setStatus("DONE");
        task.setCompletedAt(java.time.LocalDateTime.now().minusDays(1));

        TaskRequestDTO request = new TaskRequestDTO();
        request.setStatus("IN_PROGRESS");

        when(taskRepository.findById(2L)).thenReturn(Optional.of(task));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 500L)).thenReturn(Optional.of(actorMember));
        when(userRepository.findById(500L)).thenReturn(Optional.of(actorUser));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        taskService.updateTask(2L, request, 500L);

        assertNull(task.getCompletedAt(), "completedAt should be cleared when moving away from DONE");
    }

    @Test
    void bulkUpdateStatus_doneStatus_setsCompletedAt() {
        Task task1 = buildTask(10L);
        task1.setStatus("TODO");

        when(taskRepository.findAllById(List.of(10L))).thenReturn(List.of(task1));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 500L)).thenReturn(Optional.of(actorMember));
        when(userRepository.findById(500L)).thenReturn(Optional.of(actorUser));
        when(taskRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        taskService.bulkUpdateStatus(List.of(10L), "DONE", 500L);

        assertNotNull(task1.getCompletedAt(), "completedAt should be set when bulk status transitions to DONE");
    }

    @Test
    void bulkUpdateStatus_doneStatus_notifiesAssignee() {
        Task task1 = buildTask(11L);
        task1.setStatus("TODO");

        when(taskRepository.findAllById(List.of(11L))).thenReturn(List.of(task1));
        when(teamMemberRepository.findByTeamIdAndUserUserId(20L, 500L)).thenReturn(Optional.of(actorMember));
        when(userRepository.findById(500L)).thenReturn(Optional.of(actorUser));
        when(userRepository.findAllById(any())).thenReturn(List.of(assigneeUser));
        when(taskRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        taskService.bulkUpdateStatus(List.of(11L), "DONE", 500L);

        verify(notificationService).createNotification(
                eq(assigneeUser),
                contains("marked"),
                contains("/taskcard?taskId=11")
        );
    }
}
