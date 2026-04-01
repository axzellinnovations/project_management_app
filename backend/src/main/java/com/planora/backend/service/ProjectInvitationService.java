package com.planora.backend.service;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.dto.ProjectInviteRequest;
import com.planora.backend.model.Project;
import com.planora.backend.model.TeamInvitation;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamInvitationRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProjectInvitationService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final TeamInvitationRepository teamInvitationRepository;
    private final TeamMemberService teamMemberService;
    private final TeamMemberRepository teamMemberRepository;
    private final EmailService emailService;

    @Transactional
    public void inviteToProject(Long projectId, ProjectInviteRequest request, Long inviterUserId) {
        if (request == null || request.getEmail() == null || request.getEmail().trim().isEmpty()) {
            throw new RuntimeException("Email is required");
        }
        if (request.getRole() == null || request.getRole().trim().isEmpty()) {
            throw new RuntimeException("Role is required");
        }

        String inviteeEmail = request.getEmail().trim().toLowerCase();
        String roleStr = request.getRole().trim().toUpperCase();
        // Validate role is a valid TeamRole
        try {
            TeamRole.valueOf(roleStr);
        } catch (Exception e) {
            throw new RuntimeException("Invalid role: " + roleStr);
        }

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        Long teamId = project.getTeam().getId();

        // Allow TEAM OWNER and ADMIN to invite
        teamMemberService.validateOwnerOrAdmin(teamId, inviterUserId);


        // Block if user is already a member
        userRepository.findByEmailIgnoreCase(inviteeEmail).ifPresent(existingUser -> {
            teamMemberRepository.findByTeamIdAndUserUserId(teamId, existingUser.getUserId())
                .ifPresent(member -> {
                    throw new RuntimeException("This user is already a member of the project.");
                });
        });

        // Block if already invited and not expired (pending)
        teamInvitationRepository.findByTeamIdAndEmail(teamId, inviteeEmail).ifPresent(existing -> {
            if ((existing.getStatus() == null || existing.getStatus().equalsIgnoreCase("PENDING")) &&
                (existing.getExpiresAt() == null || existing.getExpiresAt().isAfter(LocalDateTime.now()))) {
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
        invitation.setStatus("PENDING");
        invitation.setRole(roleStr); // Save the invited role

        teamInvitationRepository.save(invitation);

        // Email content (no link)
        String inviterName = (inviter.getFullName() != null && !inviter.getFullName().isBlank())
                ? inviter.getFullName()
                : (inviter.getUsername() != null && !inviter.getUsername().isBlank())
                        ? inviter.getUsername()
                        : inviter.getEmail();

        emailService.sendProjectInvitationHtmlEmail(inviteeEmail, inviterName, project.getName(),
                invitation.getToken());
    }

    @Transactional
    public void acceptInvitation(String token, Long userId) {
        if (token == null || token.isBlank()) {
            throw new RuntimeException("Invalid invitation token");
        }

        TeamInvitation invitation = teamInvitationRepository.findByToken(token)
                .orElseThrow(() -> new RuntimeException("Invitation not found or invalid"));

        if (invitation.getExpiresAt() != null && invitation.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("Invitation has expired");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Only allow if email matches (optional safety check, but user could have
        // signed up with this email)
        if (!user.getEmail().equalsIgnoreCase(invitation.getEmail())) {
            throw new RuntimeException("This invitation was sent to a different email address");
        }

        // Prevent duplicate membership
        teamMemberRepository.findByTeamIdAndUserUserId(invitation.getTeam().getId(), userId)
                .ifPresent(m -> {
                    throw new RuntimeException("You are already a member of this team");
                });

        // Debug logging for investigation
        System.out.println("[DEBUG] Accepting invitation:");
        System.out.println("  Token: " + token);
        System.out.println("  Invitation ID: " + invitation.getId());
        System.out.println("  Invitation Role: '" + invitation.getRole() + "'");

        TeamMember member = new TeamMember();
        member.setTeam(invitation.getTeam());
        member.setUser(user);
        // Use the invited role, robust to case/whitespace
        TeamRole invitedRole;
        try {
            String roleStr = invitation.getRole();
            if (roleStr != null) {
                roleStr = roleStr.trim().toUpperCase();
            }
            invitedRole = TeamRole.valueOf(roleStr);
        } catch (Exception e) {
            System.out.println("[DEBUG] Invalid role, defaulting to MEMBER");
            invitedRole = TeamRole.MEMBER; // fallback
        }
        member.setRole(invitedRole);
        System.out.println("  Assigned TeamMember Role: '" + invitedRole + "'");
        teamMemberRepository.save(member);

        invitation.setStatus("ACCEPTED");
        teamInvitationRepository.save(invitation);
    }
}