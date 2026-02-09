package com.planora.backend.service;

import com.planora.backend.model.Kanban;
import com.planora.backend.repository.KanbanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class KanbanService {

    @Autowired
    KanbanRepository repository;

    public Kanban createBoard(Kanban kanban){
        return repository.save(kanban);
    }
}
