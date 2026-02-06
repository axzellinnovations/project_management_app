package com.planora.backend.controller;

import com.planora.backend.model.Sprint;
import com.planora.backend.service.SprintService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sprints")
@CrossOrigin
public class SprintController {

    private final SprintService sprintService;

    public SprintController(SprintService sprintService) {
        this.sprintService = sprintService;
    }

    // CREATE Sprint
    @PostMapping
    public Sprint createSprint(@RequestBody Sprint sprint) {
        return sprintService.createSprint(sprint);
    }

    // READ sprints by project ID
    @GetMapping("/project/{proId}")
    public List<Sprint> getSprintsByProject(@PathVariable Long proId) {
        return sprintService.getSprintsByProject(proId);
    }

    // READ sprint by ID
    @GetMapping("/{id}")
    public Sprint getSprintById(@PathVariable Long id) {
        return sprintService.getSprintById(id);
    }

    // UPDATE sprint
    @PutMapping("/{id}")
    public Sprint updateSprint(@PathVariable Long id,
                               @RequestBody Sprint sprint) {
        return sprintService.updateSprint(id, sprint);
    }

    // DELETE sprint
    @DeleteMapping("/{id}")
    public void deleteSprint(@PathVariable Long id) {
        sprintService.deleteSprint(id);
    }
}
