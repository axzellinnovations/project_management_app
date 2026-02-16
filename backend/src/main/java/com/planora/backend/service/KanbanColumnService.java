package com.planora.backend.service;


import com.planora.backend.dto.KanbanColumnRequestDTO;
import com.planora.backend.model.Kanban;
import com.planora.backend.model.KanbanColumn;
import com.planora.backend.repository.KanbanColumnRepository;
import com.planora.backend.repository.KanbanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class KanbanColumnService {

    @Autowired
    private KanbanColumnRepository kanbanColumnRepository;

    @Autowired
    private KanbanRepository kanbanRepository;

    public KanbanColumn createKanbanColumn(KanbanColumnRequestDTO dto) {
        Optional<Kanban> optionalKanban = kanbanRepository.findById(dto.getKanbanId());
        if (optionalKanban.isPresent()) {
            KanbanColumn column = new KanbanColumn();
            column.setName(dto.getName());
            column.setPosition(dto.getPosition());
            column.setKanban(optionalKanban.get());
            return kanbanColumnRepository.save(column);
        }
        throw new RuntimeException("Kanban not found");
    }

    public List<KanbanColumn> getColumnsByKanbanId(Long kanbanId) {
        return kanbanColumnRepository.findByKanbanIdOrderByPosition(kanbanId);
    }

    public Optional<KanbanColumn> getKanbanColumnById(Long id) {
        return kanbanColumnRepository.findById(id);
    }

    public KanbanColumn updateKanbanColumn(Long id, KanbanColumnRequestDTO dto) {
        Optional<KanbanColumn> optionalColumn = kanbanColumnRepository.findById(id);
        if (optionalColumn.isPresent()) {
            KanbanColumn column = optionalColumn.get();
            column.setName(dto.getName());
            column.setPosition(dto.getPosition());
            // KanbanId cannot be changed
            return kanbanColumnRepository.save(column);
        }
        throw new RuntimeException("KanbanColumn not found");
    }

    public void deleteKanbanColumn(Long id) {
        kanbanColumnRepository.deleteById(id);
    }
}



