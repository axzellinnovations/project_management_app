package com.planora.backend.service;

import com.planora.backend.model.TeamMember;
import com.planora.backend.repository.TeamMemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TeamMembershipLookupServiceTest {

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @InjectMocks
    private TeamMembershipLookupService teamMembershipLookupService;

    @Test
    void getTeamMember_returnsMember_whenFound() {
        TeamMember member = new TeamMember();
        when(teamMemberRepository.findByTeamIdAndUserUserId(5L, 1L)).thenReturn(Optional.of(member));

        TeamMember result = teamMembershipLookupService.getTeamMember(5L, 1L);

        assertNotNull(result);
        verify(teamMemberRepository).findByTeamIdAndUserUserId(5L, 1L);
    }

    @Test
    void getTeamMember_returnsNull_whenNotFound() {
        when(teamMemberRepository.findByTeamIdAndUserUserId(5L, 99L)).thenReturn(Optional.empty());

        TeamMember result = teamMembershipLookupService.getTeamMember(5L, 99L);

        assertNull(result);
    }

    @Test
    void getTeamMembersForTeams_returnsEmptyList_whenTeamIdsNull() {
        List<TeamMember> result = teamMembershipLookupService.getTeamMembersForTeams(null, 1L);
        assertTrue(result.isEmpty());
        verifyNoInteractions(teamMemberRepository);
    }

    @Test
    void getTeamMembersForTeams_returnsEmptyList_whenTeamIdsEmpty() {
        List<TeamMember> result = teamMembershipLookupService.getTeamMembersForTeams(Set.of(), 1L);
        assertTrue(result.isEmpty());
        verifyNoInteractions(teamMemberRepository);
    }

    @Test
    void getTeamMembersForTeams_returnsEmptyList_whenUserIdNull() {
        List<TeamMember> result = teamMembershipLookupService.getTeamMembersForTeams(Set.of(1L), null);
        assertTrue(result.isEmpty());
        verifyNoInteractions(teamMemberRepository);
    }

    @Test
    void getTeamMembersForTeams_returnsMembers_whenValidInputs() {
        TeamMember member = new TeamMember();
        when(teamMemberRepository.findByTeamIdInAndUserUserId(Set.of(5L, 6L), 1L))
                .thenReturn(List.of(member));

        List<TeamMember> result = teamMembershipLookupService.getTeamMembersForTeams(Set.of(5L, 6L), 1L);

        assertEquals(1, result.size());
    }
}
