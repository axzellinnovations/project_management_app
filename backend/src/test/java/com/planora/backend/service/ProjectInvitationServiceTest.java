package com.planora.backend.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;

import com.planora.backend.controller.ProjectMemberController;
import com.planora.backend.dto.ProjectInviteRequest;
import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamInvitation;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamInvitationRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class ProjectInvitationServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TeamInvitationRepository teamInvitationRepository;

    @Mock
    private TeamMemberService teamMemberService;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private SimpMessagingTemplate simpMessagingTemplate;

    @Mock
    private UserService userService;

    @InjectMocks
    private ProjectInvitationService projectInvitationService;

    @Test
    void inviteToProject_rejectsOwnerInviteForNonCreatorEmail() {
        ProjectInviteRequest request = new ProjectInviteRequest();
        request.setEmail("teammate@example.com");
        request.setRole(TeamRole.OWNER);

        Project project = project(77L, 10L, "creator@example.com");
        when(projectRepository.findById(77L)).thenReturn(Optional.of(project));

        assertThrows(AccessDeniedException.class, () -> projectInvitationService.inviteToProject(77L, request, 10L));

        verify(teamMemberService).enforceCreatorOnlyOwnerRole(11L, 10L);
        verify(teamMemberService).validateOwnerOrAdmin(11L, 10L);
        verify(teamInvitationRepository, never()).save(any(TeamInvitation.class));
    }

    @Test
    void acceptInvitation_downgradesLegacyOwnerInviteForNonCreator() {
        Team team = new Team();
        team.setId(11L);

        Project project = project(77L, 10L, "creator@example.com");
        project.setTeam(team);
        team.setProjects(Set.of(project));

        TeamInvitation invitation = new TeamInvitation();
        invitation.setId(501L);
        invitation.setToken("token-1");
        invitation.setEmail("invitee@example.com");
        invitation.setTeam(team);
        invitation.setRole("OWNER");
        invitation.setStatus("PENDING");
        invitation.setExpiresAt(LocalDateTime.now().plusDays(1));

        User invitee = new User();
        invitee.setUserId(20L);
        invitee.setEmail("invitee@example.com");
        invitee.setUsername("invitee");

        when(teamInvitationRepository.findByToken("token-1")).thenReturn(Optional.of(invitation));
        when(userRepository.findById(20L)).thenReturn(Optional.of(invitee));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 20L)).thenReturn(Optional.empty());
        when(teamMemberRepository.save(any(TeamMember.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(teamInvitationRepository.save(any(TeamInvitation.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(teamMemberRepository.findByTeamId(11L)).thenReturn(List.of());

        projectInvitationService.acceptInvitation("token-1", 20L);

        verify(teamMemberService).enforceCreatorOnlyOwnerRole(11L, 10L);

        ArgumentCaptor<TeamMember> memberCaptor = ArgumentCaptor.forClass(TeamMember.class);
        verify(teamMemberRepository).save(memberCaptor.capture());
        assertEquals(TeamRole.ADMIN, memberCaptor.getValue().getRole());

        ArgumentCaptor<ProjectMemberController.MemberEvent> eventCaptor = ArgumentCaptor.forClass(ProjectMemberController.MemberEvent.class);
        verify(simpMessagingTemplate).convertAndSend(eq("/topic/project/77/members"), eventCaptor.capture());
        assertEquals("ADMIN", eventCaptor.getValue().role);
    }

    private Project project(Long projectId, Long ownerId, String ownerEmail) {
        User owner = new User();
        owner.setUserId(ownerId);
        owner.setEmail(ownerEmail);

        Team team = new Team();
        team.setId(11L);

        Project project = new Project();
        project.setId(projectId);
        project.setName("Apollo");
        project.setOwner(owner);
        project.setTeam(team);
        return project;
    }
}
