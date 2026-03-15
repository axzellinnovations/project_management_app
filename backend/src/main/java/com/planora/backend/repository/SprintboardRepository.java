package com.planora.backend.repository;

import com.planora.backend.model.Sprint;
import com.planora.backend.model.SprintStatus;
import com.planora.backend.model.Sprintboard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SprintboardRepository extends JpaRepository<Sprintboard, Long> {

    Optional<Sprintboard> findBySprintId(Long sprintId);

    Optional<Sprintboard> findBySprintIdAndSprintStatus(Long sprintId, SprintStatus sprintStatus);

    boolean existsBySprintId(Long sprintId);
}