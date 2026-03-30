package com.planora.backend.service;

import java.util.List;

import org.springframework.stereotype.Service;

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
    public TeamMember changeMemberRoleWithPermissions(Long teamId, Long targetUserId, String newRoleStr, Long currentUserId) {
        TeamMember currentMember = validateMembership(teamId, currentUserId);
        TeamMember targetMember = teamMemberRepository
                .findByTeamIdAndUserUserId(teamId, targetUserId)
                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));

        TeamRole newRole;
        try {
            newRole = TeamRole.valueOf(newRoleStr.toUpperCase());
        } catch (Exception e) {
            throw new RuntimeException("Invalid role");
        }

        if (currentMember.getRole() == TeamRole.OWNER) {
            // Owner can change anyone's role (except their own)
            if (targetMember.getUser().getUserId().equals(currentUserId)) {
                throw new RuntimeException("Owner cannot change their own role");
            }
        } else if (currentMember.getRole() == TeamRole.ADMIN) {
            // Admin can only change MEMBER or VIEWER, and not promote to OWNER or ADMIN
            if (targetMember.getRole() == TeamRole.OWNER || targetMember.getRole() == TeamRole.ADMIN) {
                throw new RuntimeException("Admin can only change roles of MEMBER or VIEWER");
            }
            if (newRole == TeamRole.OWNER || newRole == TeamRole.ADMIN) {
                throw new RuntimeException("Admin cannot promote to OWNER or ADMIN");
            }
        } else {
            throw new RuntimeException("Only OWNER or ADMIN can change roles");
        }

        targetMember.setRole(newRole);
        return teamMemberRepository.save(targetMember);
    }
        // =====================================================
        // HELPER : VALIDATE OWNER OR ADMIN (STRICT)
        // =====================================================
        public TeamMember validateOwnerOrAdmin(Long teamId, Long userId) {
                TeamMember member = validateMembership(teamId, userId);
                if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.ADMIN) {
                        throw new RuntimeException("Only TEAM OWNER or ADMIN can perform this action");
                }
                return member;
        }

        private final TeamMemberRepository teamMemberRepository;
        private final TeamRepository teamRepository;
        private final UserRepository userRepository;

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
                        throw new RuntimeException("Only TEAM OWNER can perform this action");
                }

                return member;
        }
}
