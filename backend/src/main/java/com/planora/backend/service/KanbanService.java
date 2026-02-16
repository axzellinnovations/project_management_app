package com.planora.backend.service;

import com.planora.backend.dto.KanbanRequestDTO;
import com.planora.backend.model.Kanban;
import com.planora.backend.repository.KanbanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class KanbanService {

    @Autowired
    private KanbanRepository kanbanRepository;

    public Kanban createKanban(KanbanRequestDTO dto) {
        Kanban kanban = new Kanban();
        kanban.setName(dto.getName());
        kanban.setProjectId(dto.getProjectId());
        return kanbanRepository.save(kanban);
    }

    public List<Kanban> getAllKanbans() {
        return kanbanRepository.findAll();
    }

    public Optional<Kanban> getKanbanById(Long id) {
        return kanbanRepository.findById(id);
    }

    public Kanban updateKanban(Long id, KanbanRequestDTO dto) {
        Optional<Kanban> optionalKanban = kanbanRepository.findById(id);
        if (optionalKanban.isPresent()) {
            Kanban kanban = optionalKanban.get();
            kanban.setName(dto.getName());
            kanban.setProjectId(dto.getProjectId());
            return kanbanRepository.save(kanban);
        }
        throw new RuntimeException("Kanban not found");
    }

    public void deleteKanban(Long id) {
        kanbanRepository.deleteById(id);
    }

    public List<Kanban> getKanbansByProjectId(Long projectId) {
        return kanbanRepository.findByProjectId(projectId);
    }
}