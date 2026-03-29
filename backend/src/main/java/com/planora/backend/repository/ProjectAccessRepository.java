package com.planora.backend.repository;

import com.planora.backend.model.ProjectAccess;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectAccessRepository extends JpaRepository<ProjectAccess, Long> {
    Optional<ProjectAccess> findByProject_IdAndUser_UserId(Long projectId, Long userId);

    // Returns the N most recently accessed projects for a user, newest first
    List<ProjectAccess> findByUser_UserIdOrderByLastAccessedAtDesc(Long userId, Pageable pageable);
}
