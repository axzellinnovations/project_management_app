package com.planora.backend.repository;

import com.planora.backend.model.Sprint;
import com.planora.backend.model.SprintStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SprintRepository extends JpaRepository<Sprint, Long> {

    List<Sprint> findByProject_Id(Long projectId);

    boolean existsByProject_IdAndStatus(Long projectId, SprintStatus status);

    @Query("SELECT s FROM Sprint s WHERE s.project.id = :projectId AND s.status = :status AND s.id <> :excludeId ORDER BY s.id ASC")
    List<Sprint> findNextAvailableSprint(@Param("projectId") Long projectId, @Param("status") SprintStatus status, @Param("excludeId") Long excludeId, Pageable pageable);

    @Query("SELECT s.id, p.id, s.name, s.startDate, s.endDate, s.status, s.goal " +
           "FROM Sprint s JOIN s.project p WHERE p.id = :projectId")
    List<Object[]> findSprintRowsByProjectId(@Param("projectId") Long projectId);
}
