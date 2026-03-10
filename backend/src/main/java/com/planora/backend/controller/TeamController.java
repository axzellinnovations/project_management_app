package com.planora.backend.controller;

import com.planora.backend.dto.TeamCreationDTO;
import com.planora.backend.dto.TeamDetailDTO;
import com.planora.backend.dto.TeamSummaryDTO;
import com.planora.backend.model.Team;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.TeamService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("api/teams")
public class TeamController {

    @Autowired
    TeamService service;

    // 0. CHECK TEAM NAME
    @GetMapping("/check-name")
    public ResponseEntity<java.util.Map<String, Boolean>> checkTeamName(
            @RequestParam String name,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(service.checkTeamName(name, currentUser.getUserId()));
    }

    // 1. CREATE TEAM
    @PostMapping
    public ResponseEntity<TeamSummaryDTO> createTeam(
            @RequestBody TeamCreationDTO creationDTO,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        Long currentUserId = currentUser.getUserId();
        Team createdTeam = service.createTeam(creationDTO, currentUserId);

        TeamSummaryDTO response = new TeamSummaryDTO(
                createdTeam.getId(),
                createdTeam.getName(),
                createdTeam.getOwner().getFullName());

        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    // 2. GET MY TEAMS
    @GetMapping
    public ResponseEntity<List<TeamSummaryDTO>> getAllTeams(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Long currentUserId = currentUser.getUserId();
        return new ResponseEntity<>(service.getAllTeams(currentUserId), HttpStatus.OK);
    }

    // 3. GET SINGLE TEAM (DashBoard)
    @GetMapping("/{id}")
    public ResponseEntity<TeamDetailDTO> getTeam(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Long currentUserId = currentUser.getUserId();
        return new ResponseEntity<>(service.getTeam(id, currentUserId), HttpStatus.OK);
    }

    // 4. UPDATE TEAM
    @PutMapping("/{id}")
    public ResponseEntity<TeamSummaryDTO> updateTeam(
            @RequestBody TeamCreationDTO teamCreationDTO,
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Long currentUserId = currentUser.getUserId();

        Team updatedTeam = service.updateTeam(id, teamCreationDTO, currentUserId);

        TeamSummaryDTO response = new TeamSummaryDTO(
                updatedTeam.getId(),
                updatedTeam.getName(),
                updatedTeam.getOwner().getFullName());
        return new ResponseEntity<>(response, HttpStatus.OK);
    }

    // 5. DELETE TEAM
    @DeleteMapping("{id}")
    public ResponseEntity<Void> deleteTeam(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Long currentUserId = currentUser.getUserId();
        service.deleteTeam(id, currentUserId);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

}
