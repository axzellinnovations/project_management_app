package com.planora.backend.service;

import com.planora.backend.dto.PageDetailResponseDto;
import com.planora.backend.dto.PageRequestDto;
import com.planora.backend.dto.PageSummaryResponseDto;
import com.planora.backend.model.Project;
import com.planora.backend.model.ProjectPage;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.repository.ProjectPageRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
}
