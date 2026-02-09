package com.planora.backend.service;

import com.planora.backend.dto.KanbanColumnRequest;
import com.planora.backend.model.KanbanColumn;
import com.planora.backend.repository.KanbanColumnRepository;
import com.planora.backend.repository.KanbanRepository;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Data
@Service
public class KanbanColumnService {

    @Autowired
    KanbanColumnRepository repository;

    @Autowired
    KanbanRepository kanbanRepository;

    public KanbanColumn createColumn(KanbanColumn column) {
        return repository.save(column);
    }

    public KanbanColumn updateColumn(Long id, KanbanColumnRequest dto) {
        return repository.findById(id).map(column -> {
            column.setName(dto.getName());
            return repository.save(column);
        }).orElseThrow(() -> new RuntimeException("Column not found with id " + id));
    }
    public void deleteColumn(Long id){
        repository.deleteById(id);
    }
}
