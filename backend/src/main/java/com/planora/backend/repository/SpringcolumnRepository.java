package com.planora.backend.repository;

import com.planora.backend.model.Sprintcolumn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringcolumnRepository extends JpaRepository<Sprintcolumn, Long> {

    List<Sprintcolumn> findBySprintboardIdOrderByPosition(Long sprintboardId);
}