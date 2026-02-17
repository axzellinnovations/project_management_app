package com.planora.backend.repository;


import com.planora.backend.model.KanbanColumn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KanbanColumnRepository extends JpaRepository<KanbanColumn, Long> {

    List<KanbanColumn> findByKanbanIdOrderByPosition(Long kanbanId);
}
