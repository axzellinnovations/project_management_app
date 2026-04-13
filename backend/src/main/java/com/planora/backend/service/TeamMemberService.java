package com.planora.backend.service;

import java.util.List;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.TeamRepository;
import com.planora.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TeamMemberService {
    // Change member role with owner/admin permission logic
        @Transactional
        public TeamMember changeMemberRoleWithPermissions(
                        Long teamId,
                        Long targetUserId,
                        String newRoleStr,
                        Long currentUserId,
                        Long projectId,
                        String projectName
        ) {
        TeamMember currentMember = validateMembership(teamId, currentUserId);
        TeamMember targetMember = teamMemberRepository
                .findByTeamIdAndUserUserId(teamId, targetUserId)
                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));

        TeamRole newRole;
        try {
            newRole = TeamRole.valueOf(newRoleStr.toUpperCase());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid role");
        }

        if (currentMember.getRole() == TeamRole.OWNER) {
            // Owner can change anyone's role (except their own)
            if (targetMember.getUser().getUserId().equals(currentUserId)) {
                throw new IllegalArgumentException("Owner cannot change their own role");
            }
        } else if (currentMember.getRole() == TeamRole.ADMIN) {
            // Admin can only change MEMBER or VIEWER, and not promote to OWNER or ADMIN
            if (targetMember.getRole() == TeamRole.OWNER || targetMember.getRole() == TeamRole.ADMIN) {
                throw new AccessDeniedException("Admin can only change roles of MEMBER or VIEWER");
            }
            if (newRole == TeamRole.OWNER || newRole == TeamRole.ADMIN) {
                throw new AccessDeniedException("Admin cannot promote to OWNER or ADMIN");
            }
        } else {
            throw new AccessDeniedException("Only OWNER or ADMIN can change roles");
        }

                TeamRole oldRole = targetMember.getRole();
        targetMember.setRole(newRole);
                TeamMember updated = teamMemberRepository.save(targetMember);

                if (oldRole != newRole) {
                        String resolvedProjectName = resolveProjectName(projectName);
                        String membersLink = buildMembersLink(projectId);
                        String actorName = resolveDisplayName(currentMember.getUser());
                        String targetName = resolveDisplayName(targetMember.getUser());

                        if (!targetUserId.equals(currentUserId)) {
                                String targetMessage = actorName + " changed your role to " + newRole.name()
                                                + " in project \"" + resolvedProjectName + "\"";
                                notificationService.createNotification(targetMember.getUser(), targetMessage, membersLink);
                        }

                        String adminMessage = actorName + " changed " + targetName + "'s role from "
                                        + oldRole.name() + " to " + newRole.name() + " in project \""
                                        + resolvedProjectName + "\"";

                        teamMemberRepository.findByTeamId(teamId).stream()
                                        .filter(member -> member.getRole() == TeamRole.OWNER || member.getRole() == TeamRole.ADMIN)
                                        .filter(member -> !member.getUser().getUserId().equals(currentUserId))
                                        .filter(member -> !member.getUser().getUserId().equals(targetUserId))
                                        .forEach(member -> notificationService.createNotification(member.getUser(), adminMessage, membersLink));
                }

                return updated;
    }
        // =====================================================
        // HELPER : VALIDATE OWNER OR ADMIN (STRICT)
        // =====================================================
        public TeamMember validateOwnerOrAdmin(Long teamId, Long userId) {
                TeamMember member = validateMembership(teamId, userId);
                if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.ADMIN) {
                        throw new AccessDeniedException("Only TEAM OWNER or ADMIN can perform this action");
                }
                return member;
        }

        private final TeamMemberRepository teamMemberRepository;
        private final TeamRepository teamRepository;
        private final UserRepository userRepository;
        private final NotificationService notificationService;

        // =====================================================
        // ADD MEMBER TO TEAM (OWNER ONLY)
        // =====================================================
        public TeamMember addMember(
                        Long teamId,
                        Long targetUserId,
                        TeamRole role,
                        Long currentUserId) {
                // Only OWNER can add members
                validateOwner(teamId, currentUserId);

                Team team = teamRepository.findById(teamId)
                                .orElseThrow(() -> new RuntimeException("Team not found"));

                User targetUser = userRepository.findById(targetUserId)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                // Prevent duplicate membership
                teamMemberRepository.findByTeamIdAndUserUserId(teamId, targetUserId)
                                .ifPresent(m -> {
                                        throw new RuntimeException("User already a team member");
                                });

                TeamMember member = new TeamMember();
                member.setTeam(team);
                member.setUser(targetUser);
                member.setRole(role);

                return teamMemberRepository.save(member);
        }

        // =====================================================
        // GET ALL MEMBERS OF A TEAM (ANY MEMBER)
        // =====================================================
        @Transactional(readOnly = true)
        public List<TeamMember> getTeamMembers(Long teamId) {
                return teamMemberRepository.findByTeamId(teamId);
        }

        // =====================================================
        // UPDATE MEMBER ROLE (OWNER ONLY)
        // =====================================================
        public TeamMember updateMemberRole(
                        Long teamId,
                        Long targetUserId,
                        TeamRole newRole,
                        Long currentUserId) {
                // Only OWNER can change roles
                validateOwner(teamId, currentUserId);

                TeamMember member = teamMemberRepository
                                .findByTeamIdAndUserUserId(teamId, targetUserId)
                                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));

                member.setRole(newRole);
                return teamMemberRepository.save(member);
        }

        // =====================================================
        // REMOVE MEMBER FROM TEAM (OWNER ONLY)
        // =====================================================
        public void removeMember(
                        Long teamId,
                        Long targetUserId,
                        Long currentUserId) {
                // Only OWNER can remove members
                validateOwner(teamId, currentUserId);

                TeamMember member = teamMemberRepository
                                .findByTeamIdAndUserUserId(teamId, targetUserId)
                                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));

                teamMemberRepository.delete(member);
        }

        // =====================================================
        // REMOVE MEMBER FROM TEAM WITH PERMISSIONS
        // =====================================================
        @Transactional
        public void removeMemberWithPermissions(
                        Long teamId,
                        Long targetUserId,
                        Long currentUserId,
                        Long projectId,
                        String projectName) {
                TeamMember currentMember = validateMembership(teamId, currentUserId);
                TeamMember targetMember = teamMemberRepository
                                .findByTeamIdAndUserUserId(teamId, targetUserId)
                                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));

                if (currentMember.getRole() == TeamRole.OWNER) {
                        // Owner can remove anyone except themselves
                        if (targetMember.getUser().getUserId().equals(currentUserId)) {
                                throw new IllegalArgumentException("Owner cannot remove themselves");
                        }
                } else if (currentMember.getRole() == TeamRole.ADMIN) {
                        // Admin can only remove MEMBER or VIEWER
                        if (targetMember.getRole() == TeamRole.OWNER || targetMember.getRole() == TeamRole.ADMIN) {
                                throw new AccessDeniedException("Admin can only remove MEMBER or VIEWER");
                        }
                } else {
                        // MEMBER and VIEWER cannot remove anyone
                        throw new AccessDeniedException("Only OWNER or ADMIN can remove members");
                }

                String resolvedProjectName = resolveProjectName(projectName);
                String membersLink = buildMembersLink(projectId);
                String actorName = resolveDisplayName(currentMember.getUser());
                String targetName = resolveDisplayName(targetMember.getUser());

                teamMemberRepository.delete(targetMember);

                if (!targetUserId.equals(currentUserId)) {
                        String targetMessage = actorName + " removed you from project \""
                                        + resolvedProjectName + "\"";
                        notificationService.createNotification(targetMember.getUser(), targetMessage, "/dashboard");
                }

                String adminMessage = actorName + " removed " + targetName + " from project \""
                                + resolvedProjectName + "\"";

                teamMemberRepository.findByTeamId(teamId).stream()
                                .filter(member -> member.getRole() == TeamRole.OWNER || member.getRole() == TeamRole.ADMIN)
                                .filter(member -> !member.getUser().getUserId().equals(currentUserId))
                                .forEach(member -> notificationService.createNotification(member.getUser(), adminMessage, membersLink));
        }

        private String resolveProjectName(String projectName) {
                if (projectName == null || projectName.isBlank()) {
                        return "your project";
                }
                return projectName;
        }

        private String buildMembersLink(Long projectId) {
                if (projectId == null) {
                        return "/members";
                }
                return "/members/" + projectId;
        }

        private String resolveDisplayName(User user) {
                if (user == null) {
                        return "A team member";
                }
                if (user.getFullName() != null && !user.getFullName().isBlank()) {
                        return user.getFullName();
                }
                if (user.getUsername() != null && !user.getUsername().isBlank()) {
                        return user.getUsername();
                }
                if (user.getEmail() != null && !user.getEmail().isBlank()) {
                        return user.getEmail();
                }
                return "A team member";
        }

        // =====================================================
        // HELPER : VALIDATE MEMBERSHIP (GENERIC)
        // =====================================================
        public TeamMember validateMembership(Long teamId, Long userId) {

                return teamMemberRepository
                                .findByTeamIdAndUserUserId(teamId, userId)
                                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));
        }

        // =====================================================
        // HELPER : VALIDATE OWNER (STRICT)
        // =====================================================
        public TeamMember validateOwner(Long teamId, Long userId) {

                TeamMember member = validateMembership(teamId, userId);

                if (member.getRole() != TeamRole.OWNER) {
                        throw new AccessDeniedException("Only TEAM OWNER can perform this action");
                }

                return member;
        }

}
