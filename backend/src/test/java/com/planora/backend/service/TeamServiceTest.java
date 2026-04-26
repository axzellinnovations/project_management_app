package com.planora.backend.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.planora.backend.dto.TeamCreationDTO;
import com.planora.backend.dto.TeamDetailDTO;
import com.planora.backend.dto.TeamSummaryDTO;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.TeamRepository;
import com.planora.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
public class TeamServiceTest {

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @InjectMocks
    private TeamService teamService;

    private User testUser;
    private Team testTeam;
    private TeamMember ownerMember;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setUserId(1L);
        testUser.setFullName("Test User");
        testUser.setEmail("test@example.com");

        testTeam = new Team();
        testTeam.setId(10L);
        testTeam.setName("Test Team");
        testTeam.setOwner(testUser);

        ownerMember = new TeamMember();
        ownerMember.setUser(testUser);
        ownerMember.setTeam(testTeam);
        ownerMember.setRole(TeamRole.OWNER);
        
        testTeam.getMembers().add(ownerMember);
    }

    @Test
    void checkTeamNameAvailability_whenTeamExists() {
        when(teamRepository.findByName("Test Team")).thenReturn(Optional.of(testTeam));

        Map<String, Boolean> result = teamService.checkTeamNameAvailability("Test Team", 1L);

        assertTrue(result.get("exists"));
        assertTrue(result.get("isMember"));
    }

    @Test
    void checkTeamNameAvailability_whenTeamDoesNotExist() {
        when(teamRepository.findByName("New Team")).thenReturn(Optional.empty());

        Map<String, Boolean> result = teamService.checkTeamNameAvailability("New Team", 1L);

        assertFalse(result.get("exists"));
        assertFalse(result.get("isMember"));
    }

    @Test
    void createTeam_success() {
        TeamCreationDTO dto = new TeamCreationDTO();
        dto.setName("New Team");

        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(teamRepository.save(any(Team.class))).thenAnswer(i -> i.getArguments()[0]);

        Team result = teamService.createTeam(dto, 1L);

        assertNotNull(result);
        assertEquals("New Team", result.getName());
        assertEquals(testUser, result.getOwner());
        assertEquals(1, result.getMembers().size());
        assertEquals(TeamRole.OWNER, result.getMembers().iterator().next().getRole());
    }

    @Test
    void getMyTeams_success() {
        when(teamMemberRepository.findByUserUserId(1L)).thenReturn(List.of(ownerMember));

        List<TeamSummaryDTO> result = teamService.getMyTeams(1L);

        assertEquals(1, result.size());
        assertEquals("Test Team", result.getFirst().getName());
    }

    @Test
    void getTeamDetails_success() {
        when(teamRepository.findById(10L)).thenReturn(Optional.of(testTeam));

        TeamDetailDTO result = teamService.getTeamDetails(10L, 1L);

        assertEquals(10L, result.getId());
        assertEquals("Test Team", result.getName());
        assertEquals(1, result.getMembers().size());
    }

    @Test
    void getTeamDetails_unauthorized() {
        when(teamRepository.findById(10L)).thenReturn(Optional.of(testTeam));

        assertThrows(RuntimeException.class, () -> teamService.getTeamDetails(10L, 99L));
    }

    @Test
    void updateTeam_success() {
        TeamCreationDTO dto = new TeamCreationDTO();
        dto.setName("Updated Name");

        when(teamRepository.findById(10L)).thenReturn(Optional.of(testTeam));
        when(teamRepository.save(any(Team.class))).thenAnswer(i -> i.getArguments()[0]);

        Team result = teamService.updateTeam(10L, dto, 1L);

        assertEquals("Updated Name", result.getName());
    }

    @Test
    void deleteTeam_success() {
        when(teamRepository.findById(10L)).thenReturn(Optional.of(testTeam));

        teamService.deleteTeam(10L, 1L);

        verify(teamRepository).delete(testTeam);
    }

    @Test
    void deleteTeam_forbidden() {
        when(teamRepository.findById(10L)).thenReturn(Optional.of(testTeam));

        assertThrows(RuntimeException.class, () -> teamService.deleteTeam(10L, 99L));
    }
}
