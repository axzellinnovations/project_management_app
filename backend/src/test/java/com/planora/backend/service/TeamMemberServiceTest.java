package com.planora.backend.service;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.anyList;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.TeamRepository;
import com.planora.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class TeamMemberServiceTest {

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private TeamMemberService teamMemberService;

    private TeamMember creatorMember;
    private TeamMember legacyOwnerMember;

    @BeforeEach
    void setUp() {
        creatorMember = member(1L, TeamRole.ADMIN);
        legacyOwnerMember = member(2L, TeamRole.OWNER);
    }

    @Test
    void enforceCreatorOnlyOwnerRole_demotesLegacyOwnerAndPromotesCreator() {
        when(teamMemberRepository.findByTeamId(50L)).thenReturn(List.of(creatorMember, legacyOwnerMember));

        teamMemberService.enforceCreatorOnlyOwnerRole(50L, 1L);

        assertEquals(TeamRole.OWNER, creatorMember.getRole());
        assertEquals(TeamRole.ADMIN, legacyOwnerMember.getRole());
        verify(teamMemberRepository).saveAll(anyList());
    }

    @Test
    void changeMemberRoleWithPermissions_rejectsOwnerAssignmentForNonCreator() {
        TeamMember currentOwner = member(1L, TeamRole.OWNER);
        TeamMember targetMember = member(2L, TeamRole.MEMBER);

        when(teamMemberRepository.findByTeamId(50L)).thenReturn(List.of(currentOwner, targetMember));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 1L)).thenReturn(Optional.of(currentOwner));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 2L)).thenReturn(Optional.of(targetMember));

        assertThrows(AccessDeniedException.class, () -> teamMemberService.changeMemberRoleWithPermissions(
                50L,
                2L,
                "OWNER",
                1L,
                99L,
                "Apollo",
                1L));

        verify(teamMemberRepository, never()).save(targetMember);
    }

    @Test
    void changeMemberRoleWithPermissions_rejectsDemotingProjectCreator() {
        TeamMember currentOwner = member(1L, TeamRole.OWNER);

        when(teamMemberRepository.findByTeamId(50L)).thenReturn(List.of(currentOwner));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 1L)).thenReturn(Optional.of(currentOwner));

        assertThrows(AccessDeniedException.class, () -> teamMemberService.changeMemberRoleWithPermissions(
                50L,
                1L,
                "ADMIN",
                1L,
                99L,
                "Apollo",
                1L));
    }

    private TeamMember member(Long userId, TeamRole role) {
        User user = new User();
        user.setUserId(userId);
        user.setEmail("user" + userId + "@example.com");

        TeamMember member = new TeamMember();
        member.setUser(user);
        member.setRole(role);
        return member;
    }
}
