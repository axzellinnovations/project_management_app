package com.planora.backend.service;

import com.planora.backend.dto.SearchResponseDTO;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;

    public List<SearchResponseDTO> globalSearch(String query, Long userId) {
        if (query == null || query.trim().isEmpty()) {
            return new ArrayList<>();
        }

        List<SearchResponseDTO> results = new ArrayList<>();
        PageRequest pageRequest = PageRequest.of(0, 5);

        // 1. Search Projects
        List<Project> projects = projectRepository.searchProjectsByName(query, userId, pageRequest);
        results.addAll(projects.stream()
                .map(p -> SearchResponseDTO.builder()
                        .id(p.getId())
                        .title(p.getName())
                        .type("PROJECT")
                        .subtitle("Project • " + (p.getProjectKey() != null ? p.getProjectKey() : "PRJ"))
                        .link("/summary/" + p.getId())
                        .build())
                .collect(Collectors.toList()));

        // 2. Search Boards (Shortcut to Kanban for now)
        results.addAll(projects.stream()
                .map(p -> SearchResponseDTO.builder()
                        .id(p.getId())
                        .title(p.getName() + " Board")
                        .type("BOARD")
                        .subtitle("Board • " + (p.getProjectKey() != null ? p.getProjectKey() : "BRD"))
                        .link(p.getType() != null && p.getType().toString().contains("AGILE") 
                                ? "/sprint-board?projectId=" + p.getId() 
                                : "/kanban?projectId=" + p.getId())
                        .build())
                .collect(Collectors.toList()));

        // 3. Search Tasks
        List<Task> tasks = taskRepository.searchTasksByTitle(query, userId, pageRequest);
        results.addAll(tasks.stream()
                .map(t -> SearchResponseDTO.builder()
                        .id(t.getId())
                        .title(t.getTitle())
                        .type("TASK")
                        .subtitle(t.getProject().getName() + " • " + t.getStatus())
                        .link("/summary/" + t.getProject().getId() + "?taskId=" + t.getId())
                        .build())
                .collect(Collectors.toList()));

        return results;
    }
}
