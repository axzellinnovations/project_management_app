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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TeamMemberService {

        private final TeamMemberRepository teamMemberRepository;
        private final TeamRepository teamRepository;
        private final UserRepository userRepository;

        // =====================================================
        // ADD MEMBER TO TEAM (OWNER OR ADMIN)
        // =====================================================
        public TeamMember addMember(
                        Long teamId,
                        Long targetUserId,
                        TeamRole role,
                        Long currentUserId) {
                // OWNER and ADMIN can add members
                validateOwnerOrAdmin(teamId, currentUserId);

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
        // UPDATE MEMBER ROLE (OWNER OR ADMIN)
        // =====================================================
        public TeamMember updateMemberRole(
                        Long teamId,
                        Long targetUserId,
                        TeamRole newRole,
                        Long currentUserId) {
                // OWNER and ADMIN can change roles
                validateOwnerOrAdmin(teamId, currentUserId);

                TeamMember member = teamMemberRepository
                                .findByTeamIdAndUserUserId(teamId, targetUserId)
                                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));

                member.setRole(newRole);
                return teamMemberRepository.save(member);
        }

        // =====================================================
        // REMOVE MEMBER FROM TEAM (OWNER OR ADMIN)
        // =====================================================
        public void removeMember(
                        Long teamId,
                        Long targetUserId,
                        Long currentUserId) {
                // OWNER and ADMIN can remove members
                validateOwnerOrAdmin(teamId, currentUserId);

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
                                .orElseThrow(() -> new AccessDeniedException("User is not a member of this team"));
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

        // =====================================================
        // HELPER : VALIDATE OWNER OR ADMIN
        // =====================================================
        public TeamMember validateOwnerOrAdmin(Long teamId, Long userId) {
                TeamMember member = validateMembership(teamId, userId);

                if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.ADMIN) {
                        throw new RuntimeException("Only TEAM OWNER or ADMIN can perform this action");
                }

                return member;
        }
}
