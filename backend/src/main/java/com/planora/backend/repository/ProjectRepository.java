package com.planora.backend.repository;

import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    boolean existsByProjectKey(String projectKey);
    boolean existsByProjectKeyAndTeamId(String projectKey, Long teamId);

    List<Project> findByTeamIn(List<Team> teams);

    @Query("SELECT p FROM Project p WHERE LOWER(p.name) LIKE LOWER(CONCAT('%', :query, '%')) AND p.team.id IN (SELECT tm.team.id FROM TeamMember tm WHERE tm.user.userId = :userId)")
    List<Project> searchProjectsByName(@Param("query") String query, @Param("userId") Long userId, Pageable pageable);
}
