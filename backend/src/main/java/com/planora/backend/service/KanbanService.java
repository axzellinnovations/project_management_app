package com.planora.backend.service;

import com.planora.backend.dto.KanbanBoardResponseDTO;
import com.planora.backend.dto.KanbanRequestDTO;
import com.planora.backend.model.Kanban;
import com.planora.backend.model.KanbanColumn;
import com.planora.backend.repository.KanbanColumnRepository;
import com.planora.backend.repository.KanbanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class KanbanService {

    @Autowired
    private KanbanRepository kanbanRepository;

    @Autowired
    private KanbanColumnRepository kanbanColumnRepository;

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

    @Transactional
    public Kanban getOrCreateKanbanForProject(Long projectId) {
        List<Kanban> existing = kanbanRepository.findByProjectId(projectId);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }

        Kanban kanban = new Kanban();
        kanban.setName("Kanban Board");
        kanban.setProjectId(projectId);
        Kanban saved = kanbanRepository.save(kanban);

        // Create default columns
        List<Object[]> defaults = Arrays.asList(
            new Object[]{"To Do",       "TODO",        0, "#F3F4F6"},
            new Object[]{"In Progress", "IN_PROGRESS", 1, "#EFF6FF"},
            new Object[]{"In Review",   "IN_REVIEW",   2, "#FEF3C7"},
            new Object[]{"Done",        "DONE",        3, "#DCFCE7"}
        );
        for (Object[] def : defaults) {
            KanbanColumn col = new KanbanColumn();
            col.setName((String) def[0]);
            col.setStatus((String) def[1]);
            col.setPosition((Integer) def[2]);
            col.setColor((String) def[3]);
            col.setWipLimit(0);
            col.setKanban(saved);
            kanbanColumnRepository.save(col);
        }

        return saved;
    }

    public KanbanBoardResponseDTO getKanbanBoard(Long projectId) {
        Kanban kanban = getOrCreateKanbanForProject(projectId);
        List<KanbanColumn> columns = kanbanColumnRepository.findByKanbanIdOrderByPosition(kanban.getId());

        List<KanbanBoardResponseDTO.KanbanColumnDTO> columnDTOs = columns.stream()
            .map(col -> new KanbanBoardResponseDTO.KanbanColumnDTO(
                col.getId(),
                col.getName(),
                col.getStatus(),
                col.getPosition(),
                col.getColor(),
                col.getWipLimit()
            ))
            .collect(Collectors.toList());

        KanbanBoardResponseDTO dto = new KanbanBoardResponseDTO();
        dto.setKanbanId(kanban.getId());
        dto.setName(kanban.getName());
        dto.setProjectId(kanban.getProjectId());
        dto.setColumns(columnDTOs);
        return dto;
    }
}
