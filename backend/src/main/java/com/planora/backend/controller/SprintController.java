package com.planora.backend.controller;

import com.planora.backend.dto.SprintCreateRequestDTO;
import com.planora.backend.dto.SprintResponseDTO;
import com.planora.backend.dto.StartSprintRequest;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.SprintService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/sprints")
public class SprintController {

    private final SprintService sprintService;

    public SprintController(SprintService sprintService) {
        this.sprintService = sprintService;
    }

    @PostMapping
    public ResponseEntity<SprintResponseDTO> createSprint(
            @RequestBody SprintCreateRequestDTO request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        SprintResponseDTO created = sprintService.createSprint(request, currentUser.getUserId());
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @GetMapping("/project/{proId}")
    public ResponseEntity<List<SprintResponseDTO>> getSprintsByProject(
            @PathVariable Long proId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        List<SprintResponseDTO> sprints = sprintService.getSprintsByProject(proId, currentUser.getUserId());
        return new ResponseEntity<>(sprints, HttpStatus.OK);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SprintResponseDTO> getSprintById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        SprintResponseDTO sprint = sprintService.getSprintById(id, currentUser.getUserId());
        return new ResponseEntity<>(sprint, HttpStatus.OK);
    }

    @PutMapping("/{id}")
    public ResponseEntity<SprintResponseDTO> updateSprint(
            @PathVariable Long id,
            @RequestBody SprintCreateRequestDTO request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        SprintResponseDTO updated = sprintService.updateSprint(id, request, currentUser.getUserId());
        return new ResponseEntity<>(updated, HttpStatus.OK);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSprint(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        sprintService.deleteSprint(id, currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    @PutMapping("/{id}/start")
    public ResponseEntity<SprintResponseDTO> startSprint(
            @PathVariable Long id,
            @RequestBody StartSprintRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        SprintResponseDTO started = sprintService.startSprint(id, request.startDate(), request.endDate(), currentUser.getUserId());
        return new ResponseEntity<>(started, HttpStatus.OK);
    }

    @PutMapping("/{id}/complete")
    public ResponseEntity<SprintResponseDTO> completeSprint(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        SprintResponseDTO completed = sprintService.completeSprint(id, currentUser.getUserId());
        return new ResponseEntity<>(completed, HttpStatus.OK);
    }
}

