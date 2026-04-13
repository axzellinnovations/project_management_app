package com.planora.backend.repository;

import com.planora.backend.model.ProjectFavorite;
import com.planora.backend.model.Project;
import com.planora.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ProjectFavoriteRepository extends JpaRepository<ProjectFavorite, Long> {
    Optional<ProjectFavorite> findByUserAndProject(User user, Project project);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"project.owner", "project.team"})
    List<ProjectFavorite> findByUserOrderByCreatedAtDesc(User user);  // most recently favourited first
    boolean existsByUserAndProject(User user, Project project);
    void deleteByUserAndProject(User user, Project project);
}
