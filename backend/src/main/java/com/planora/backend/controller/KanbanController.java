package com.planora.backend.controller;

import com.planora.backend.model.Kanban;
import com.planora.backend.model.Task;
import com.planora.backend.service.KanbanColumnService;
import com.planora.backend.service.KanbanService;
import com.planora.backend.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/kanban")
public class KanbanController {

    @Autowired
    KanbanService service;
    @Autowired
    KanbanColumnService columnService;
    @Autowired
    TaskService taskService;

    @PostMapping("/create")
    public ResponseEntity<Kanban> createBoard(@RequestBody Kanban kanban) {
        return new ResponseEntity<>(service.createBoard(kanban), HttpStatus.OK);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Kanban> getBoard(@PathVariable Long id) {
        return ResponseEntity.ok(service.getBoard(id));
    }

        // 3. Reorder Columns
        @PutMapping("/columns/reorder")
        public ResponseEntity<Void> reorder(@RequestBody List<Long> columnIds) {
            columnService.reorderColumns(columnIds);
            return ResponseEntity.ok().build();
        }

        // 4. Move Task
        @PatchMapping("/tasks/{taskId}/move")
        public ResponseEntity<Task> moveTask(@PathVariable Long taskId,
                                             @RequestParam Long columnId,
                                             @RequestParam int position) {
            return ResponseEntity.ok(taskService.moveTask(taskId, columnId, position));
        }
}
