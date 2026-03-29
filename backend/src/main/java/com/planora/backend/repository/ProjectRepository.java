package com.planora.backend.repository;

import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    boolean existsByProjectKey(String projectKey);

    List<Project> findByTeamIn(List<Team> teams);
}
