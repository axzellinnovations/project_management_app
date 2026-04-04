package com.planora.backend.service;

import com.planora.backend.dto.TaskRequestDTO;
import com.planora.backend.dto.TaskResponseDTO;
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
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.TaskActivityService;import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
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
    private NotificationService notificationService;
    @Mock
    private TaskActivityService taskActivityService;

    @InjectMocks
    private TaskService taskService;

    private Project project;
    private TeamMember creator;
    private TeamMember assignee;

    @BeforeEach
    void setUp() {
        Team team = new Team();
        team.setId(20L);

        project = new Project();
        project.setId(10L);
        project.setTeam(team);

        User creatorUser = new User();
        creatorUser.setUserId(100L);
        creatorUser.setUsername("creator");

        creator = new TeamMember();
        creator.setId(1L);
        creator.setRole(TeamRole.MEMBER);
        creator.setUser(creatorUser);
        creator.setTeam(team);

        User assigneeUser = new User();
        assigneeUser.setUserId(200L);
        assigneeUser.setUsername("assignee");

        assignee = new TeamMember();
        assignee.setId(2L);
        assignee.setRole(TeamRole.MEMBER);
        assignee.setUser(assigneeUser);
        assignee.setTeam(team);
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

        RuntimeException exception = assertThrows(RuntimeException.class, () -> taskService.createTask(request, 100L));

        assertEquals("Insufficient Permissions: VIEWER cannot perform this action.", exception.getMessage());
        verify(taskRepository, never()).save(any(Task.class));
        verify(notificationService, never()).createNotification(any(), any(), any());
    }
}
