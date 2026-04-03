package com.planora.backend.repository;

import com.planora.backend.model.Sprintcolumn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringcolumnRepository extends JpaRepository<Sprintcolumn, Long> {

    @Query("SELECT sc FROM Sprintcolumn sc WHERE sc.sprintboard.id = :sprintboardId ORDER BY sc.position ASC")
    List<Sprintcolumn> findBySprintboardIdOrderByPosition(@Param("sprintboardId") Long sprintboardId);
}