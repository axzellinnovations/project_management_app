package com.planora.backend.controller;

import com.planora.backend.dto.KanbanRequestDTO;
import com.planora.backend.model.Kanban;
import com.planora.backend.service.KanbanService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/kanbans")
public class KanbanController {

    @Autowired
    private KanbanService kanbanService;

    @PostMapping
    public ResponseEntity<Kanban> createKanban(@RequestBody KanbanRequestDTO dto) {
        return ResponseEntity.ok(kanbanService.createKanban(dto));
    }

    @GetMapping
    public ResponseEntity<List<Kanban>> getAllKanbans() {
        return ResponseEntity.ok(kanbanService.getAllKanbans());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Kanban> getKanbanById(@PathVariable Long id) {
        return kanbanService.getKanbanById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Kanban> updateKanban(@PathVariable Long id, @RequestBody KanbanRequestDTO dto) {
        return ResponseEntity.ok(kanbanService.updateKanban(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteKanban(@PathVariable Long id) {
        kanbanService.deleteKanban(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/project/{projectId}")
    public ResponseEntity<List<Kanban>> getKanbansByProjectId(@PathVariable Long projectId) {
        return ResponseEntity.ok(kanbanService.getKanbansByProjectId(projectId));
    }
}