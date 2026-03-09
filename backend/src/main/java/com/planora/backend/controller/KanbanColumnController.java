package com.planora.backend.controller;

import com.planora.backend.dto.KanbanColumnRequestDTO;
import com.planora.backend.model.KanbanColumn;
import com.planora.backend.service.KanbanColumnService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/kanban-columns")
public class KanbanColumnController {

    @Autowired
    private KanbanColumnService kanbanColumnService;

    @PostMapping
    public ResponseEntity<KanbanColumn> createKanbanColumn(@RequestBody KanbanColumnRequestDTO dto) {
        return ResponseEntity.ok(kanbanColumnService.createKanbanColumn(dto));
    }

    @GetMapping("/kanban/{kanbanId}")
    public ResponseEntity<List<KanbanColumn>> getColumnsByKanbanId(@PathVariable Long kanbanId) {
        return ResponseEntity.ok(kanbanColumnService.getColumnsByKanbanId(kanbanId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<KanbanColumn> getKanbanColumnById(@PathVariable Long id) {
        return kanbanColumnService.getKanbanColumnById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<KanbanColumn> updateKanbanColumn(@PathVariable Long id, @RequestBody KanbanColumnRequestDTO dto) {
        return ResponseEntity.ok(kanbanColumnService.updateKanbanColumn(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteKanbanColumn(@PathVariable Long id) {
        kanbanColumnService.deleteKanbanColumn(id);
        return ResponseEntity.noContent().build();
    }
}
