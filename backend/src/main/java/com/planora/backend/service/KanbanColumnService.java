package com.planora.backend.service;


import com.planora.backend.dto.KanbanColumnRequestDTO;
import com.planora.backend.dto.KanbanColumnSettingsDTO;
import com.planora.backend.model.Kanban;
import com.planora.backend.model.KanbanColumn;
import com.planora.backend.repository.KanbanColumnRepository;
import com.planora.backend.repository.KanbanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
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
            // Auto-generate status from name: "In Review" → "IN_REVIEW"
            String autoStatus = dto.getName().trim().toUpperCase().replaceAll("\\s+", "_").replaceAll("[^A-Z0-9_]", "");
            column.setStatus(autoStatus);
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

    @Transactional
    public void reorderColumns(List<Map<String, Integer>> reorderRequest) {
        for (Map<String, Integer> entry : reorderRequest) {
            Long columnId = Long.valueOf(entry.get("id"));
            Integer position = entry.get("position");
            kanbanColumnRepository.updatePosition(columnId, position);
        }
    }

    public KanbanColumn renameColumn(Long id, String name) {
        KanbanColumn column = kanbanColumnRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("KanbanColumn not found"));
        column.setName(name);
        return kanbanColumnRepository.save(column);
    }

    public KanbanColumn updateColumnSettings(Long id, KanbanColumnSettingsDTO dto) {
        KanbanColumn column = kanbanColumnRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("KanbanColumn not found"));
        if (dto.getColor() != null) {
            column.setColor(dto.getColor());
        }
        if (dto.getWipLimit() != null) {
            column.setWipLimit(dto.getWipLimit());
        }
        return kanbanColumnRepository.save(column);
    }
}



