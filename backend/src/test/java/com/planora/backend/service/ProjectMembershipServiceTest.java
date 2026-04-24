package com.planora.backend.service;

import com.planora.backend.model.TeamMember;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProjectMembershipServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private TeamMembershipLookupService teamMembershipLookupService;

    @InjectMocks
    private ProjectMembershipService projectMembershipService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        sampleUser = new User();
        sampleUser.setUserId(1L);
        sampleUser.setEmail("alice@example.com");
    }

    @Test
    void resolveProjectTeamId_returnsTeamId_whenProjectExists() {
        when(projectRepository.findTeamIdByProjectId(10L)).thenReturn(5L);

        Long teamId = projectMembershipService.resolveProjectTeamId(10L);

        assertEquals(5L, teamId);
    }

    @Test
    void resolveProjectTeamId_throwsRuntimeException_whenProjectNotFound() {
        when(projectRepository.findTeamIdByProjectId(99L)).thenReturn(null);

        assertThrows(RuntimeException.class,
                () -> projectMembershipService.resolveProjectTeamId(99L));
    }

    @Test
    void isProjectMember_returnsTrue_whenUserIsMember() {
        when(projectRepository.findTeamIdByProjectId(10L)).thenReturn(5L);
        TeamMember member = new TeamMember();
        when(teamMembershipLookupService.getTeamMember(5L, 1L)).thenReturn(member);

        assertTrue(projectMembershipService.isProjectMember(10L, 1L));
    }

    @Test
    void isProjectMember_returnsFalse_whenUserNotMember() {
        when(projectRepository.findTeamIdByProjectId(10L)).thenReturn(5L);
        when(teamMembershipLookupService.getTeamMember(5L, 1L)).thenReturn(null);

        assertFalse(projectMembershipService.isProjectMember(10L, 1L));
    }

    @Test
    void assertProjectMembership_doesNotThrow_whenUserIsMember() {
        when(projectRepository.findTeamIdByProjectId(10L)).thenReturn(5L);
        when(teamMembershipLookupService.getTeamMember(5L, 1L)).thenReturn(new TeamMember());

        assertDoesNotThrow(() -> projectMembershipService.assertProjectMembership(10L, sampleUser));
    }

    @Test
    void assertProjectMembership_throws_whenUserNotMember() {
        when(projectRepository.findTeamIdByProjectId(10L)).thenReturn(5L);
        when(teamMembershipLookupService.getTeamMember(5L, 1L)).thenReturn(null);

        assertThrows(RuntimeException.class,
                () -> projectMembershipService.assertProjectMembership(10L, sampleUser));
    }

    @Test
    void assertProjectMembership_throws_whenUserIsNull() {
        assertThrows(RuntimeException.class,
                () -> projectMembershipService.assertProjectMembership(10L, null));
    }

    @Test
    void assertTeamMembership_doesNotThrow_whenUserIsMember() {
        when(teamMembershipLookupService.getTeamMember(5L, 1L)).thenReturn(new TeamMember());

        assertDoesNotThrow(() -> projectMembershipService.assertTeamMembership(5L, sampleUser));
    }

    @Test
    void assertTeamMembership_throws_whenUserNotMember() {
        when(teamMembershipLookupService.getTeamMember(5L, 1L)).thenReturn(null);

        assertThrows(RuntimeException.class,
                () -> projectMembershipService.assertTeamMembership(5L, sampleUser));
    }
}
