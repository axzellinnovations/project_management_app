package com.planora.backend.service;

import com.planora.backend.dto.ProjectDTO;
import com.planora.backend.dto.ProjectResponseDTO;
import com.planora.backend.exception.ConflictException;
import com.planora.backend.model.Project;
import com.planora.backend.model.ProjectType;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectAccessRepository;
import com.planora.backend.repository.ProjectFavoriteRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.TeamRepository;
import com.planora.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private TeamMemberRepository teamMemberRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TeamRepository teamRepository;
    @Mock
    private ProjectAccessRepository projectAccessRepository;
    @Mock
    private ProjectFavoriteRepository projectFavoriteRepository;
    @Mock
    private SprintRepository sprintRepository;
    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private ProjectService projectService;

    private User owner;
    private Team existingTeam;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setUserId(7L);
        owner.setUsername("owner");
        owner.setEmail("owner@example.com");

        existingTeam = new Team();
        existingTeam.setId(10L);
        existingTeam.setName("Alpha Team");
        existingTeam.setOwner(owner);
    }

    @Test
    void createProject_withNewTeam_createsTeamOwnerMembershipAndInitialSprintForAgile() {
        ProjectDTO dto = ProjectDTO.builder()
                .name("Planora")
                .projectKey("PLN")
                .description("Project description")
                .type(ProjectType.AGILE)
                .ownerId(7L)
                .teamOption("NEW")
                .teamName("Fresh Team")
                .build();

        Team savedTeam = new Team();
        savedTeam.setId(20L);
        savedTeam.setName("Fresh Team");
        savedTeam.setOwner(owner);

        when(userRepository.findById(7L)).thenReturn(Optional.of(owner));
        when(teamRepository.findByName("Fresh Team")).thenReturn(Optional.empty());
        when(teamRepository.save(any(Team.class))).thenReturn(savedTeam);
        when(projectRepository.existsByProjectKeyAndTeamId("PLN", 20L)).thenReturn(false);
        when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> {
            Project p = invocation.getArgument(0);
            p.setId(100L);
            return p;
        });

        ProjectResponseDTO response = projectService.createProject(dto);

        assertEquals(100L, response.getId());
        assertEquals("Planora", response.getName());
        assertEquals("PLN", response.getProjectKey());
        assertEquals(20L, response.getTeamId());
        assertEquals("Fresh Team", response.getTeamName());
        assertEquals(7L, response.getOwnerId());

        ArgumentCaptor<TeamMember> memberCaptor = ArgumentCaptor.forClass(TeamMember.class);
        verify(teamMemberRepository).save(memberCaptor.capture());
        assertEquals(TeamRole.OWNER, memberCaptor.getValue().getRole());
        assertEquals(owner, memberCaptor.getValue().getUser());
        assertEquals(savedTeam, memberCaptor.getValue().getTeam());

        ArgumentCaptor<Sprint> sprintCaptor = ArgumentCaptor.forClass(Sprint.class);
        verify(sprintRepository, times(1)).save(sprintCaptor.capture());
        assertEquals("PLN Sprint 1", sprintCaptor.getValue().getName());
    }

    @Test
    void createProject_withExistingTeam_upgradesMemberRoleToOwnerAndDoesNotCreateSprintForKanban() {
        ProjectDTO dto = ProjectDTO.builder()
                .name("Kanban Project")
                .projectKey("KAN")
                .description("Kanban flow")
                .type(ProjectType.KANBAN)
                .ownerId(7L)
                .teamOption("EXISTING")
                .teamName("Alpha Team")
                .build();

        TeamMember member = new TeamMember();
        member.setTeam(existingTeam);
        member.setUser(owner);
        member.setRole(TeamRole.MEMBER);

        when(userRepository.findById(7L)).thenReturn(Optional.of(owner));
        when(teamRepository.findByName("Alpha Team")).thenReturn(Optional.of(existingTeam));
        when(projectRepository.existsByProjectKeyAndTeamId("KAN", 10L)).thenReturn(false);
        when(teamMemberRepository.findByTeamIdAndUserUserId(10L, 7L)).thenReturn(Optional.of(member));
        when(projectRepository.save(any(Project.class))).thenAnswer(invocation -> {
            Project p = invocation.getArgument(0);
            p.setId(101L);
            return p;
        });

        ProjectResponseDTO response = projectService.createProject(dto);

        assertEquals(101L, response.getId());
        assertEquals("Kanban Project", response.getName());
        assertEquals(TeamRole.OWNER, member.getRole());
        verify(teamMemberRepository).save(member);
        verify(sprintRepository, never()).save(any(Sprint.class));
    }

    @Test
    void createProject_withExistingTeamAndDuplicateKey_throwsConflictException() {
        ProjectDTO dto = ProjectDTO.builder()
                .name("Duplicate Key")
                .projectKey("DUP")
                .type(ProjectType.AGILE)
                .ownerId(7L)
                .teamOption("EXISTING")
                .teamName("Alpha Team")
                .build();

        when(userRepository.findById(7L)).thenReturn(Optional.of(owner));
        when(teamRepository.findByName("Alpha Team")).thenReturn(Optional.of(existingTeam));
        when(projectRepository.existsByProjectKeyAndTeamId("DUP", 10L)).thenReturn(true);

        assertThrows(ConflictException.class, () -> projectService.createProject(dto));

        verify(projectRepository, never()).save(any(Project.class));
        verify(sprintRepository, never()).save(any(Sprint.class));
    }

    @Test
    void createProject_withInvalidTeamOption_throwsRuntimeException() {
        ProjectDTO dto = ProjectDTO.builder()
                .name("Invalid")
                .projectKey("INV")
                .type(ProjectType.AGILE)
                .ownerId(7L)
                .teamOption("UNKNOWN")
                .teamName("Alpha Team")
                .build();

        when(userRepository.findById(7L)).thenReturn(Optional.of(owner));

        RuntimeException exception = assertThrows(RuntimeException.class, () -> projectService.createProject(dto));
        assertEquals("Invalid team option", exception.getMessage());

        verify(teamRepository, never()).save(any(Team.class));
        verify(projectRepository, never()).save(any(Project.class));
    }

    @Test
    void checkKeyExists_delegatesToRepository() {
        when(projectRepository.existsByProjectKey("PLN")).thenReturn(true);

        boolean exists = projectService.checkKeyExists("PLN");

        assertEquals(true, exists);
        verify(projectRepository).existsByProjectKey(eq("PLN"));
    }
}