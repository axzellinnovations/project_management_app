package com.planora.backend.service;

import com.planora.backend.model.Sprint;
import com.planora.backend.repository.SprintRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SprintService {

    private final SprintRepository sprintRepository;

    public SprintService(SprintRepository sprintRepository) {
        this.sprintRepository = sprintRepository;
    }

    // CREATE Sprint
    public Sprint createSprint(Sprint sprint) {

        // validation: start date must be before end date
        if (sprint.getStartDate().isAfter(sprint.getEndDate())) {
            throw new RuntimeException("Start date cannot be after end date");
        }

        // default status
        if (sprint.getStatus() == null || sprint.getStatus().isBlank()) {
            sprint.setStatus("PLANNED");
        }

        return sprintRepository.save(sprint);
    }

    // READ all sprints by project ID
    public List<Sprint> getSprintsByProject(Long proId) {
        return sprintRepository.findByProId(proId);
    }

    // READ sprint by ID
    public Sprint getSprintById(Long id) {
        return sprintRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));
    }

    // UPDATE sprint
    public Sprint updateSprint(Long id, Sprint updatedSprint) {

        Sprint existingSprint = getSprintById(id);

        existingSprint.setName(updatedSprint.getName());
        existingSprint.setStartDate(updatedSprint.getStartDate());
        existingSprint.setEndDate(updatedSprint.getEndDate());
        existingSprint.setStatus(updatedSprint.getStatus());

        return sprintRepository.save(existingSprint);
    }

    // DELETE sprint
    public void deleteSprint(Long id) {
        sprintRepository.deleteById(id);
    }
}
