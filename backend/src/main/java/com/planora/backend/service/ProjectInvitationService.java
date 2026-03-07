package com.planora.backend.service;

import com.planora.backend.dto.ProjectInviteRequest;
import com.planora.backend.model.Project;
import com.planora.backend.model.TeamInvitation;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamInvitationRepository;
import com.planora.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProjectInvitationService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final TeamInvitationRepository teamInvitationRepository;
    private final TeamMemberService teamMemberService;
    private final EmailService emailService;

    @Transactional
    public void inviteToProject(Long projectId, ProjectInviteRequest request, Long inviterUserId) {
        if (request == null || request.getEmail() == null || request.getEmail().trim().isEmpty()) {
            throw new RuntimeException("Email is required");
        }

        String inviteeEmail = request.getEmail().trim().toLowerCase();

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        Long teamId = project.getTeam().getId();

        // Only TEAM OWNER can invite
        teamMemberService.validateOwner(teamId, inviterUserId);

        // If already invited and not expired -> block
        teamInvitationRepository.findByTeamIdAndEmail(teamId, inviteeEmail).ifPresent(existing -> {
            if (existing.getExpiresAt() == null || existing.getExpiresAt().isAfter(LocalDateTime.now())) {
                throw new RuntimeException("Invitation already sent to this email");
            }
        });

        User inviter = userRepository.findById(inviterUserId)
                .orElseThrow(() -> new RuntimeException("Inviter not found"));

        // Save invitation (token generated even though we are not sending link yet)
        TeamInvitation invitation = new TeamInvitation();
        invitation.setEmail(inviteeEmail);
        invitation.setTeam(project.getTeam());
        invitation.setToken(UUID.randomUUID().toString());
        invitation.setInvitedAt(LocalDateTime.now());
        invitation.setExpiresAt(LocalDateTime.now().plusDays(7));

        teamInvitationRepository.save(invitation);

        // Email content (no link)
        String inviterName = (inviter.getFullName() != null && !inviter.getFullName().isBlank())
                ? inviter.getFullName()
                : (inviter.getUsername() != null && !inviter.getUsername().isBlank())
                ? inviter.getUsername()
                : inviter.getEmail();

        emailService.sendProjectInvitationHtmlEmail(inviteeEmail, inviterName, project.getName());
    }
}