package com.planora.backend.repository;

import com.planora.backend.model.Sprint;
import com.planora.backend.model.SprintStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SprintRepository extends JpaRepository<Sprint, Long> {

    List<Sprint> findByProject_Id(Long projectId);

    boolean existsByProject_IdAndStatus(Long projectId, SprintStatus status);
}
