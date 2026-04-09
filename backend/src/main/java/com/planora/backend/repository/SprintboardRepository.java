package com.planora.backend.repository;

import com.planora.backend.model.Sprint;
import com.planora.backend.model.SprintStatus;
import com.planora.backend.model.Sprintboard;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

import java.util.Optional;

public interface SprintboardRepository extends JpaRepository<Sprintboard, Long> {

    Optional<Sprintboard> findBySprintId(Long sprintId);

    Optional<Sprintboard> findBySprintIdAndSprintStatus(Long sprintId, SprintStatus sprintStatus);

    boolean existsBySprintId(Long sprintId);

    @Query("SELECT new com.planora.backend.dto.DashboardBoardDTO(sb.id, s.name, p.id, p.name, sb.updatedAt) " +
           "FROM Sprintboard sb " +
           "JOIN Sprint s ON sb.sprint.id = s.id " +
           "JOIN Project p ON s.project.id = p.id " +
           "JOIN TeamMember tm ON p.team.id = tm.team.id " +
           "WHERE tm.user.userId = :userId " +
           "ORDER BY sb.updatedAt DESC")
    List<com.planora.backend.dto.DashboardBoardDTO> findRecentSprintboardsForUser(@Param("userId") Long userId, Pageable pageable);
}