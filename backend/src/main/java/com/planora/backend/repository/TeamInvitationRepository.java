package com.planora.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.planora.backend.model.TeamInvitation;

public interface TeamInvitationRepository extends JpaRepository<TeamInvitation, Long> {
    Optional<TeamInvitation> findByTeamIdAndEmail(Long teamId, String email);

    Optional<TeamInvitation> findByToken(String token);

    java.util.List<TeamInvitation> findByTeamIdAndStatus(Long teamId, String status);
}