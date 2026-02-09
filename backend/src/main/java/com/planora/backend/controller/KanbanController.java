package com.planora.backend.controller;

import com.planora.backend.model.Kanban;
import com.planora.backend.service.KanbanService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/board")
public class KanbanController {

    @Autowired
    KanbanService service;

    @PostMapping("/create")
    public ResponseEntity<Kanban> createBoard(@RequestBody Kanban kanban) {
        return new ResponseEntity<>(service.createBoard(kanban), HttpStatus.OK);
    }
}
