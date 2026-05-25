package com.planora.backend.repository;

import com.planora.backend.model.GithubIntegration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GithubIntegrationRepository extends JpaRepository<GithubIntegration, Long> {

    @Query("SELECT i FROM GithubIntegration i WHERE i.projectId = :projectId AND i.active = true")
    Optional<GithubIntegration> findActiveByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT i FROM GithubIntegration i WHERE i.projectId = :projectId")
    List<GithubIntegration> findByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT i FROM GithubIntegration i WHERE i.active = true")
    List<GithubIntegration> findAllActive();

    @Modifying
    @Query("UPDATE GithubIntegration i SET i.active = false WHERE i.projectId = :projectId")
    void deactivateByProjectId(@Param("projectId") Long projectId);
}
