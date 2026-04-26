package com.planora.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import com.planora.backend.model.TeamInvitation;

public interface TeamInvitationRepository extends JpaRepository<TeamInvitation, Long> {
    java.util.List<TeamInvitation> findByTeamIdAndEmail(Long teamId, String email);

    @EntityGraph(attributePaths = {"team.projects"})
    Optional<TeamInvitation> findByToken(String token);

    java.util.List<TeamInvitation> findByTeamIdAndStatus(Long teamId, String status);
}