package com.planora.backend.service;

import com.planora.backend.dto.PageDetailResponseDto;
import com.planora.backend.dto.PageRequestDto;
import com.planora.backend.dto.PageSummaryResponseDto;
import com.planora.backend.model.Project;
import com.planora.backend.model.ProjectPage;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectPageRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectPageServiceTest {

    @Mock
    private ProjectPageRepository repository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private TeamMemberRepository teamMemberRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private ProjectPageService service;

    @Test
    void getProjectPages_returnsSummariesForMembers() {
        Team team = new Team();
        team.setId(77L);

        Project project = new Project();
        project.setId(22L);
        project.setTeam(team);

        TeamMember member = new TeamMember();
        member.setRole(TeamRole.MEMBER);

        ProjectPage first = ProjectPage.builder().id(1L).projectId(22L).title("Overview").content("A").build();
        ProjectPage second = ProjectPage.builder().id(2L).projectId(22L).title("Notes").content("B").build();

        when(projectRepository.findById(22L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(77L, 10L)).thenReturn(Optional.of(member));
        when(repository.findByProjectId(22L)).thenReturn(List.of(first, second));

        List<PageSummaryResponseDto> result = service.getProjectPages(22L, 10L);

        assertEquals(2, result.size());
        assertEquals("Overview", result.get(0).getTitle());
        assertEquals("Notes", result.get(1).getTitle());
    }

    @Test
    void updatePage_viewerDenied() {
        Team team = new Team();
        team.setId(50L);

        Project project = new Project();
        project.setId(9L);
        project.setTeam(team);

        ProjectPage existing = ProjectPage.builder().id(100L).projectId(9L).title("Old").content("Old content").build();

        TeamMember viewer = new TeamMember();
        viewer.setRole(TeamRole.VIEWER);

        PageRequestDto request = new PageRequestDto();
        request.setTitle("New");
        request.setContent("New content");

        when(repository.findById(100L)).thenReturn(Optional.of(existing));
        when(projectRepository.findById(9L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 99L)).thenReturn(Optional.of(viewer));

        AccessDeniedException exception = assertThrows(AccessDeniedException.class,
                () -> service.updatePage(100L, request, 99L));

        assertEquals("Insufficient permission for this action", exception.getMessage());
    }

    @Test
    void getPageById_returnsDetailDto() {
        Team team = new Team();
        team.setId(15L);

        Project project = new Project();
        project.setId(3L);
        project.setTeam(team);

        TeamMember member = new TeamMember();
        member.setRole(TeamRole.MEMBER);

        ProjectPage page = ProjectPage.builder()
                .id(4L)
                .projectId(3L)
                .title("Architecture")
                .content("Detailed content")
                .updatedAt(LocalDateTime.parse("2026-03-20T10:15:30"))
                .build();

        when(repository.findById(4L)).thenReturn(Optional.of(page));
        when(projectRepository.findById(3L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(15L, 88L)).thenReturn(Optional.of(member));

        PageDetailResponseDto dto = service.getPageById(4L, 88L);

        assertEquals(4L, dto.getId());
        assertEquals("Architecture", dto.getTitle());
        assertEquals("Detailed content", dto.getContent());
        assertEquals("2026-03-20T10:15:30", dto.getUpdatedAt());
        verify(repository).findById(4L);
    }

        @Test
        void createPage_setsOwnershipAndNotifiesOwnersAndAdmins() {
        Team team = new Team();
        team.setId(90L);

        Project project = new Project();
        project.setId(40L);
        project.setTeam(team);

        TeamMember member = new TeamMember();
        member.setRole(TeamRole.MEMBER);

        TeamMember ownerMember = new TeamMember();
        ownerMember.setRole(TeamRole.OWNER);
        User owner = new User();
        owner.setUserId(501L);
        owner.setUsername("owner");
        ownerMember.setUser(owner);

        TeamMember adminMember = new TeamMember();
        adminMember.setRole(TeamRole.ADMIN);
        User admin = new User();
        admin.setUserId(502L);
        admin.setUsername("admin");
        adminMember.setUser(admin);

        PageRequestDto request = new PageRequestDto();
        request.setTitle("Runbook");
        request.setContent("Ops notes");

        ProjectPage savedPage = ProjectPage.builder()
            .id(700L)
            .projectId(40L)
            .title("Runbook")
            .content("Ops notes")
            .createdByUserId(200L)
            .updatedByUserId(200L)
            .build();

        User actor = new User();
        actor.setUserId(200L);
        actor.setUsername("editor");

        when(projectRepository.findById(40L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(90L, 200L)).thenReturn(Optional.of(member));
        when(teamMemberRepository.findByTeamIdAndRoleIn(eq(90L), any(Set.class)))
            .thenReturn(List.of(ownerMember, adminMember));
        when(repository.save(any(ProjectPage.class))).thenReturn(savedPage);
        when(userRepository.findById(200L)).thenReturn(Optional.of(actor));

        ProjectPage result = service.createPage(40L, request, 200L);

        assertEquals(700L, result.getId());
        verify(notificationService).createNotification(owner, "editor created page: Runbook", "/pages/700?projectId=40");
        verify(notificationService).createNotification(admin, "editor created page: Runbook", "/pages/700?projectId=40");

        ArgumentCaptor<ProjectPage> captor = ArgumentCaptor.forClass(ProjectPage.class);
        verify(repository).save(captor.capture());
        assertEquals(200L, captor.getValue().getCreatedByUserId());
        assertEquals(200L, captor.getValue().getUpdatedByUserId());
        }

        @Test
        void updatePage_titleChangeNotifiesImpactedStakeholders() {
        Team team = new Team();
        team.setId(50L);

        Project project = new Project();
        project.setId(9L);
        project.setTeam(team);

        TeamMember editorMember = new TeamMember();
        editorMember.setRole(TeamRole.MEMBER);

        ProjectPage existing = ProjectPage.builder()
            .id(100L)
            .projectId(9L)
            .title("Old Title")
            .content("Old content")
            .createdByUserId(11L)
            .updatedByUserId(12L)
            .build();

        ProjectPage updated = ProjectPage.builder()
            .id(100L)
            .projectId(9L)
            .title("New Title")
            .content("Old content")
            .createdByUserId(11L)
            .updatedByUserId(99L)
            .build();

        User actor = new User();
        actor.setUserId(99L);
        actor.setUsername("actor");

        User creator = new User();
        creator.setUserId(11L);
        creator.setUsername("creator");

        User lastEditor = new User();
        lastEditor.setUserId(12L);
        lastEditor.setUsername("lasteditor");

        PageRequestDto request = new PageRequestDto();
        request.setTitle("New Title");
        request.setContent("Old content");

        when(repository.findById(100L)).thenReturn(Optional.of(existing));
        when(projectRepository.findById(9L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 99L)).thenReturn(Optional.of(editorMember));
        when(repository.save(any(ProjectPage.class))).thenReturn(updated);
        when(userRepository.findById(99L)).thenReturn(Optional.of(actor));
        when(userRepository.findAllById(any())).thenReturn(List.of(creator, lastEditor));

        PageDetailResponseDto response = service.updatePage(100L, request, 99L);

        assertEquals("New Title", response.getTitle());
        verify(notificationService).createNotification(creator,
            "actor renamed page from \"Old Title\" to \"New Title\"",
            "/pages/100?projectId=9");
        verify(notificationService).createNotification(lastEditor,
            "actor renamed page from \"Old Title\" to \"New Title\"",
            "/pages/100?projectId=9");
        }

        @Test
        void updatePage_contentOnlyDoesNotNotify() {
        Team team = new Team();
        team.setId(50L);

        Project project = new Project();
        project.setId(9L);
        project.setTeam(team);

        TeamMember editorMember = new TeamMember();
        editorMember.setRole(TeamRole.MEMBER);

        ProjectPage existing = ProjectPage.builder()
            .id(100L)
            .projectId(9L)
            .title("Stable Title")
            .content("Old content")
            .createdByUserId(11L)
            .updatedByUserId(12L)
            .build();

        PageRequestDto request = new PageRequestDto();
        request.setTitle("Stable Title");
        request.setContent("New content only");

        when(repository.findById(100L)).thenReturn(Optional.of(existing));
        when(projectRepository.findById(9L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 99L)).thenReturn(Optional.of(editorMember));
        when(repository.save(any(ProjectPage.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.updatePage(100L, request, 99L);

        verify(notificationService, never()).createNotification(any(User.class), any(String.class), any(String.class));
        }

        @Test
        void deletePage_notifiesImpactedStakeholders() {
        Team team = new Team();
        team.setId(75L);

        Project project = new Project();
        project.setId(33L);
        project.setTeam(team);

        TeamMember editorMember = new TeamMember();
        editorMember.setRole(TeamRole.MEMBER);

        ProjectPage page = ProjectPage.builder()
            .id(210L)
            .projectId(33L)
            .title("Release Notes")
            .createdByUserId(11L)
            .updatedByUserId(12L)
            .build();

        User actor = new User();
        actor.setUserId(99L);
        actor.setUsername("actor");

        User creator = new User();
        creator.setUserId(11L);
        creator.setUsername("creator");

        User lastEditor = new User();
        lastEditor.setUserId(12L);
        lastEditor.setUsername("lasteditor");

        when(repository.findById(210L)).thenReturn(Optional.of(page));
        when(projectRepository.findById(33L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(75L, 99L)).thenReturn(Optional.of(editorMember));
        when(userRepository.findById(99L)).thenReturn(Optional.of(actor));
        when(userRepository.findAllById(any())).thenReturn(List.of(creator, lastEditor));

        service.deletePage(210L, 99L);

        verify(notificationService).createNotification(creator,
            "actor deleted page: Release Notes",
            "/pages?projectId=33");
        verify(notificationService).createNotification(lastEditor,
            "actor deleted page: Release Notes",
            "/pages?projectId=33");
        verify(repository).delete(page);
        }
}
