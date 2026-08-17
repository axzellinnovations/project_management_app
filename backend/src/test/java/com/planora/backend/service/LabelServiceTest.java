package com.planora.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.planora.backend.dto.LabelRequestDTO;
import com.planora.backend.dto.LabelResponseDTO;
import com.planora.backend.model.Label;
import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.repository.LabelRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;

@ExtendWith(MockitoExtension.class)
class LabelServiceTest {

    @Mock
    private LabelRepository labelRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @InjectMocks
    private LabelService service;

    private Project project;
    private Team team;

    @BeforeEach
    void setUp() {
        team = new Team();
        team.setId(100L);

        project = new Project();
        project.setId(10L);
        project.setTeam(team);
    }

    @Test
    void findOrCreate_reusesExistingProjectLabelRegardlessOfColor() {
        Label existing = new Label("bug", "#000000", project);
        when(labelRepository.findFirstByProjectIdAndNameIgnoreCase(10L, "bug"))
                .thenReturn(Optional.of(existing));

        Label result = service.findOrCreate("bug", "#d73a4a", project);

        assertEquals(existing, result);
        verify(labelRepository, never()).save(any(Label.class));
    }

    @Test
    void getProjectLabels_returnsLabelsWhenUserIsMember() {
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(100L, 1L))
                .thenReturn(Optional.of(new TeamMember()));
        Label label = new Label("Feature", "#22C55E", project);
        label.setId(5L);
        when(labelRepository.findByProjectId(10L)).thenReturn(List.of(label));

        List<LabelResponseDTO> result = service.getProjectLabels(10L, 1L);

        assertEquals(1, result.size());
        assertEquals("Feature", result.get(0).getName());
        assertEquals("#22C55E", result.get(0).getColor());
    }

    @Test
    void createLabel_savesAndReturnsNewDTO() {
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(100L, 1L))
                .thenReturn(Optional.of(new TeamMember()));

        Label saved = new Label("Bug", "#EF4444", project);
        saved.setId(1L);
        when(labelRepository.save(any(Label.class))).thenReturn(saved);

        LabelRequestDTO request = new LabelRequestDTO();
        request.setProjectId(10L);
        request.setName("Bug");
        request.setColor("#EF4444");

        LabelResponseDTO result = service.createLabel(request, 1L);

        assertNotNull(result);
        assertEquals(1L, result.getId());
        assertEquals("Bug", result.getName());
        assertEquals("#EF4444", result.getColor());
    }

    @Test
    void updateLabel_updatesNameAndColor() {
        Label label = new Label("Old Name", "#111111", project);
        label.setId(1L);
        when(labelRepository.findById(1L)).thenReturn(Optional.of(label));
        when(teamMemberRepository.findByTeamIdAndUserUserId(100L, 1L))
                .thenReturn(Optional.of(new TeamMember()));

        Label saved = new Label("New Name", "#222222", project);
        saved.setId(1L);
        when(labelRepository.save(label)).thenReturn(saved);

        LabelRequestDTO request = new LabelRequestDTO();
        request.setName("New Name");
        request.setColor("#222222");

        LabelResponseDTO result = service.updateLabel(1L, request, 1L);

        assertEquals("New Name", result.getName());
        assertEquals("#222222", result.getColor());
        verify(labelRepository).save(label);
    }

    @Test
    void deleteLabel_deletesSuccessfully() {
        Label label = new Label("To Delete", "#FF0000", project);
        label.setId(1L);
        when(labelRepository.findById(1L)).thenReturn(Optional.of(label));
        when(teamMemberRepository.findByTeamIdAndUserUserId(100L, 1L))
                .thenReturn(Optional.of(new TeamMember()));

        service.deleteLabel(1L, 1L);

        verify(labelRepository).delete(label);
    }

    @Test
    void validateMembership_throwsExceptionWhenUserNotMember() {
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(100L, 999L))
                .thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> service.getProjectLabels(10L, 999L));
    }
}
