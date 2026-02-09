package com.planora.backend.repository;

import com.planora.backend.model.Kanban;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface KanbanRepository extends JpaRepository<Kanban, Long> {
}
