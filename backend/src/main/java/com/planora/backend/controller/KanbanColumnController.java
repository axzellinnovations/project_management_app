package com.planora.backend.controller;

import com.planora.backend.dto.KanbanColumnRequest;
import com.planora.backend.model.KanbanColumn;
import com.planora.backend.service.KanbanColumnService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/columns")
public class KanbanColumnController {


    @Autowired
    KanbanColumnService service;

    @PostMapping("/create")
    public ResponseEntity<KanbanColumn> createColumn(@RequestBody KanbanColumn column){
        return new ResponseEntity<>(service.createColumn(column),HttpStatus.OK);
    }

    @PutMapping("/{id}")
    public ResponseEntity<KanbanColumn> updateColumn(@PathVariable Long id, @RequestBody KanbanColumnRequest dto){
        return ResponseEntity.ok(service.updateColumn(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteColumn(@PathVariable Long id){
        service.deleteColumn(id);
        return ResponseEntity.noContent().build();
    }

}
