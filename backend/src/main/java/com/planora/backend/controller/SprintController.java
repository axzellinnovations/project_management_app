package com.planora.backend.controller;

import com.planora.backend.dto.StartSprintRequest;
import com.planora.backend.model.Sprint;
import com.planora.backend.service.SprintService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
    public ResponseEntity<Sprint> createSprint(@RequestBody Sprint sprint) {
        Sprint createdSprint = sprintService.createSprint(sprint);
        return new ResponseEntity<>(createdSprint, HttpStatus.CREATED);
    }

    // READ sprints by project ID
    @GetMapping("/project/{proId}")
    public ResponseEntity<List<Sprint>> getSprintsByProject(@PathVariable Long proId) {
        List<Sprint> sprints = sprintService.getSprintsByProject(proId);
        return new ResponseEntity<>(sprints, HttpStatus.OK);
    }

    // READ sprint by ID
    @GetMapping("/{id}")
    public ResponseEntity<Sprint> getSprintById(@PathVariable Long id) {
        Sprint sprint = sprintService.getSprintById(id);
        return new ResponseEntity<>(sprint, HttpStatus.OK);
    }

    // UPDATE sprint
    @PutMapping("/{id}")
    public ResponseEntity<Sprint> updateSprint(@PathVariable Long id,
                                               @RequestBody Sprint sprint) {
        Sprint updatedSprint = sprintService.updateSprint(id, sprint);
        return new ResponseEntity<>(updatedSprint, HttpStatus.OK);
    }

    // DELETE sprint
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSprint(@PathVariable Long id) {
        sprintService.deleteSprint(id);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    // START Sprint
    @PutMapping("/{id}/start")
    public ResponseEntity<Sprint> startSprint(@PathVariable Long id,
                                              @RequestBody StartSprintRequest request) {
        Sprint started = sprintService.startSprint(id, request.startDate(), request.endDate());
        return new ResponseEntity<>(started, HttpStatus.OK);
    }
}
