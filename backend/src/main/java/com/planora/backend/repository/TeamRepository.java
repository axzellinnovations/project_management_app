package com.planora.backend.repository;

import com.planora.backend.model.Team;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {
    @EntityGraph(attributePaths = {"owner", "members.user", "projects", "invitations"})
    @Override
    Optional<Team> findById(Long id);

    @EntityGraph(attributePaths = {"owner", "members.user", "projects", "invitations"})
    Optional<Team> findByName(String name);
}
