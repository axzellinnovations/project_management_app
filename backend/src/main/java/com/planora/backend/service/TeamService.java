package com.planora.backend.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.dto.*;
import com.planora.backend.model.*;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.TeamRepository;
import com.planora.backend.repository.UserRepository;

@Service
public class TeamService {

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TeamMemberRepository teamMemberRepository;

    // Checks if team name is already taken and if the user is already a member
    @Transactional(readOnly = true)
    public Map<String, Boolean> checkTeamNameAvailability(String name, Long currentUserId) {
        Map<String, Boolean> status = new HashMap<>();
        Optional<Team> existingTeam = teamRepository.findByName(name.trim());

        if (existingTeam.isPresent()) {
            status.put("exists", true);
            // Checks if the current user ID exists in the team's member list
            boolean isMember = existingTeam.get().getMembers().stream()
                    .anyMatch(member -> member.getUser().getUserId().equals(currentUserId));
            status.put("isMember", isMember);
        } else {
            status.put("exists", false);
            status.put("isMember", false);
        }
        return status;
    }

    // Creates a new team and sets the creator as the Owner
    @Transactional
    public Team createTeam(TeamCreationDTO dto, Long currentUserId) {
        // Gets the creator's details from the database
        User creator = userRepository.findById(currentUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Step 1: Create the Team object with the given name
        Team team = new Team();
        team.setName(dto.getName());
        team.setOwner(creator);
        team.setCreatedAt(LocalDateTime.now());

        // Step 2: Add the creator to the team with the OWNER role
        TeamMember ownerMembership = new TeamMember();
        ownerMembership.setUser(creator);
        ownerMembership.setTeam(team);
        ownerMembership.setRole(TeamRole.OWNER);
        ownerMembership.setJoinedAt(LocalDateTime.now());

        team.getMembers().add(ownerMembership);

        // Step 3: Save the team and its member details to the database
        return teamRepository.save(team);
    }

    // Gets the list of all teams where the current user is a member
    @Transactional(readOnly = true)
    public List<TeamSummaryDTO> getMyTeams(Long currentUserId) {
        List<TeamMember> memberships = teamMemberRepository.findByUserUserId(currentUserId);

        // Converts team data into a simple summary format for the UI
        return memberships.stream()
                .map(membership -> new TeamSummaryDTO(
                        membership.getTeam().getId(),
                        membership.getTeam().getName(),
                        membership.getTeam().getOwner().getFullName()))
                .collect(Collectors.toList());
    }

    // Gets full details of a team if the user is a member
    @Transactional(readOnly = true)
    public TeamDetailDTO getTeamDetails(Long teamId, Long currentUserId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new RuntimeException("Team not found"));

        // Security check: Verify if user is actually in the team
        boolean isMember = team.getMembers().stream()
                    .anyMatch(m -> m.getUser().getUserId().equals(currentUserId));

        if (!isMember) {
            throw new RuntimeException("Unauthorized: You are not a member of this team");
        }

        return convertToDetailDTO(team);
    }

    // Updates team information like the team name
    @Transactional
    public Team updateTeam(Long teamId, TeamCreationDTO dto, Long currentUserId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new RuntimeException("Team not found"));

        // Security check: Find the user's role in this team
        TeamMember currentUserMember = team.getMembers().stream()
                .filter(m -> m.getUser().getUserId().equals(currentUserId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("User not found in team"));

        // Only Owners and Admins are allowed to edit team settings
        if (currentUserMember.getRole() != TeamRole.OWNER && currentUserMember.getRole() != TeamRole.ADMIN) {
            throw new RuntimeException("Forbidden: Only Owners or Admins can update");
        }

        team.setName(dto.getName());
        return teamRepository.save(team);
    }

    // Deletes the team from the system (Owner only)
    @Transactional
    public void deleteTeam(Long teamId, Long currentUserId) {
        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new RuntimeException("Team not found"));

        // Security check: Only the owner is allowed to delete the team
        if (!team.getOwner().getUserId().equals(currentUserId)) {
            throw new RuntimeException("Forbidden: Only the owner can delete");
        }

        // Clears the projects list to prevent database errors before deletion
        team.getProjects().clear();
        teamRepository.save(team);
        teamRepository.flush();

        teamRepository.delete(team);
    }

    // Helper method to convert Team database object into a UI-friendly DTO
    private TeamDetailDTO convertToDetailDTO(Team team) {
        TeamDetailDTO dto = new TeamDetailDTO();
        dto.setId(team.getId());
        dto.setName(team.getName());
        dto.setCreatedAt(team.getCreatedAt());

        // Maps the list of team members
        List<MemberDTO> memberDTOs = team.getMembers().stream()
                .map(member -> new MemberDTO(
                        member.getUser().getUserId(),
                        member.getUser().getFullName(),
                        member.getUser().getEmail(),
                        member.getRole(),
                        member.getJoinedAt()))
                .collect(Collectors.toList());
        dto.setMembers(memberDTOs);

        // Maps pending invitations sent to emails
        List<PendingInviteDTO> inviteDTOs = team.getInvitations().stream()
                .map(invite -> new PendingInviteDTO(
                        invite.getId(),
                        invite.getEmail(),
                        invite.getInvitedAt()))
                .collect(Collectors.toList());
        dto.setPendingInvites(inviteDTOs);

        // Maps the projects owned by this team
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
