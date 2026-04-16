package com.planora.backend.repository;


import com.planora.backend.model.KanbanColumn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KanbanColumnRepository extends JpaRepository<KanbanColumn, Long> {

    List<KanbanColumn> findByKanbanIdOrderByPosition(Long kanbanId);

    @Modifying
    @Query("UPDATE KanbanColumn c SET c.position = :position WHERE c.id = :id")
    void updatePosition(@Param("id") Long id, @Param("position") Integer position);
}
