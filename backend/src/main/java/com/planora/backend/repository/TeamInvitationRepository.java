package com.planora.backend.repository;

import com.planora.backend.model.TeamInvitation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TeamInvitationRepository extends JpaRepository<TeamInvitation, Long> {
    Optional<TeamInvitation> findByTeamIdAndEmail(Long teamId, String email);

    Optional<TeamInvitation> findByToken(String token);
}