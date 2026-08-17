package com.planora.backend.repository;

import com.planora.backend.model.GithubIntegration;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GithubIntegrationRepository extends JpaRepository<GithubIntegration, Long> {

    @EntityGraph(attributePaths = {"project"})
    List<GithubIntegration> findByProjectIdAndActiveTrue(Long projectId);

    @EntityGraph(attributePaths = {"project"})
    Optional<GithubIntegration> findByIdAndProjectId(Long id, Long projectId);

    @EntityGraph(attributePaths = {"project"})
    Optional<GithubIntegration> findByProjectIdAndRepositoryFullName(Long projectId, String repositoryFullName);

    boolean existsByProjectIdAndRepositoryFullName(Long projectId, String repositoryFullName);

    @EntityGraph(attributePaths = {"project"})
    List<GithubIntegration> findAllByActiveTrue();

    @EntityGraph(attributePaths = {"project"})
    List<GithubIntegration> findByRepositoryFullNameIgnoreCaseAndActiveTrue(String repositoryFullName);
}
