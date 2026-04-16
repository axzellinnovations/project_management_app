package com.planora.backend.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.planora.backend.dto.MemberDTO;
import com.planora.backend.dto.PendingInviteDTO;
import com.planora.backend.dto.ProjectSummaryDTO;
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

import org.springframework.transaction.annotation.Transactional;

@Service
public class TeamService {

        @Autowired
        private TeamRepository teamRepository;

        @Autowired
        private UserRepository userRepository;

        @Autowired
        private TeamMemberRepository teamMemberRepository;

        @Transactional(readOnly = true)
        public java.util.Map<String, Boolean> checkTeamName(String name, Long currentUserId) {
                java.util.Map<String, Boolean> result = new java.util.HashMap<>();
                java.util.Optional<Team> teamOpt = teamRepository.findByName(name.trim());
                if (teamOpt.isPresent()) {
                        result.put("exists", true);
                        boolean isMember = teamOpt.get().getMembers().stream()
                                        .anyMatch(m -> m.getUser().getUserId().equals(currentUserId));
                        result.put("isMember", isMember);
                } else {
                        result.put("exists", false);
                        result.put("isMember", false);
                }
                return result;
        }

        @Transactional
        public Team createTeam(TeamCreationDTO dto, Long currentUserId) {
                User owner = userRepository.findById(currentUserId)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                // 1. CREATE TEAM
                Team team = new Team();
                team.setName(dto.getName());
                team.setOwner(owner);
                team.setCreatedAt(LocalDateTime.now());

                // 2. Add Owner as Member
                TeamMember member = new TeamMember();
                member.setUser(owner);
                member.setTeam(team);
                member.setRole(TeamRole.OWNER);
                member.setJoinedAt(LocalDateTime.now());
                team.getMembers().add(member);

                // Handle Invites via Email

                return teamRepository.save(team);
        }

        // 2. GET MY TEAMS
        @Transactional(readOnly = true)
        public List<TeamSummaryDTO> getAllTeams(Long currentUserId) {
                List<TeamMember> memberships = teamMemberRepository.findByUserUserId(currentUserId);

                // Covert To DTOs
                return memberships.stream()
                                .map(membership -> new TeamSummaryDTO(
                                                membership.getTeam().getId(),
                                                membership.getTeam().getName(),
                                                membership.getTeam().getOwner().getFullName()))
                                .collect(Collectors.toList());
        }

        // 3. GET SINGLE TEAM DASHBOARD
        @Transactional(readOnly = true)
        public TeamDetailDTO getTeam(Long id, Long currentUserId) {
                Team team = teamRepository.findById(id)
                                .orElseThrow(() -> new RuntimeException("Team not found"));

                // Check the user is a member
                boolean isMember = team.getMembers().stream()
                                .anyMatch(m -> m.getUser().getUserId().equals(currentUserId));

                if (!isMember) {
                        throw new RuntimeException("Access Denied: You are not a member of this team");
                }

                return mapToDetailDTO(team);

        }

        // 4. UPDATE TEAM
        @Transactional
        public Team updateTeam(Long teamId, TeamCreationDTO dto, Long currentUserId) {
                Team team = teamRepository.findById(teamId)
                                .orElseThrow(() -> new RuntimeException("Team not found"));

                // Security Check
                TeamMember member = team.getMembers().stream()
                                .filter(m -> m.getUser().getUserId().equals(currentUserId))
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException("Access Denied"));

                if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.ADMIN) {
                        throw new RuntimeException("Permission Denied");
                }

                team.setName(dto.getName());

                return teamRepository.save(team);
        }

        // 5. DELETE TEAM
        @Transactional
        public void deleteTeam(Long id, Long currentUserId) {
                Team team = teamRepository.findById(id)
                                .orElseThrow(() -> new RuntimeException("Team not found"));

                // Security Check
                if (!team.getOwner().getUserId().equals(currentUserId)) {
                        throw new RuntimeException("Permission Denied");
                }

                team.getProjects().clear();
                teamRepository.save(team);
                teamRepository.flush();

                teamRepository.delete(team);
        }

        private TeamDetailDTO mapToDetailDTO(Team team) {

                TeamDetailDTO dto = new TeamDetailDTO();

                // basic
                dto.setId(team.getId());
                dto.setName(team.getName());
                dto.setCreatedAt(team.getCreatedAt());

                List<MemberDTO> memberDTOs = team.getMembers().stream()
                                .map(member -> new MemberDTO( // <--- CHANGED HERE
                                                member.getUser().getUserId(),
                                                member.getUser().getFullName(),
                                                member.getUser().getEmail(),
                                                member.getRole(),
                                                member.getJoinedAt()))
                                .collect(Collectors.toList());
                dto.setMembers(memberDTOs);

                List<PendingInviteDTO> inviteDTOs = team.getInvitations().stream()
                                .map(invite -> new PendingInviteDTO(
                                                invite.getId(),
                                                invite.getEmail(),
                                                invite.getInvitedAt()))
                                .collect(Collectors.toList());
                dto.setPendingInvites(inviteDTOs);

                // 4. Map Projects
                // (Assuming ProjectDTO is also separate, or adjust as needed)
                List<ProjectSummaryDTO> projectDTOs = team.getProjects().stream()
                                .map(project -> new ProjectSummaryDTO(
                                                project.getId(),
                                                project.getName(),
                                                project.getDescription(),
                                                project.getCreatedAt()))
                                .collect(Collectors.toList());
                dto.setProjects(projectDTOs);

                return dto;
        }

}
