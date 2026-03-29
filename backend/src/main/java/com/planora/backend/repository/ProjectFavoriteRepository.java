package com.planora.backend.repository;

import com.planora.backend.model.ProjectFavorite;
import com.planora.backend.model.Project;
import com.planora.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ProjectFavoriteRepository extends JpaRepository<ProjectFavorite, Long> {
    Optional<ProjectFavorite> findByUserAndProject(User user, Project project);
    List<ProjectFavorite> findByUser(User user);
    boolean existsByUserAndProject(User user, Project project);
    void deleteByUserAndProject(User user, Project project);
}
