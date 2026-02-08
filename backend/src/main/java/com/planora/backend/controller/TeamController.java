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

    //1. CREATE TEAM
    @PostMapping
    public ResponseEntity<Team> createTeam(
            @RequestBody TeamCreationDTO creationDTO,
            @AuthenticationPrincipal UserPrincipal currentUser){

        Long currentUserId = currentUser.getUserId();
        Team createdTeam = service.createTeam(creationDTO, currentUserId);
        return new ResponseEntity<>(createdTeam, HttpStatus.CREATED);
    }

    //2. GET MY TEAMS
    @GetMapping
    public ResponseEntity<List<TeamSummaryDTO>> getAllTeams(
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
        return new ResponseEntity<>(service.getAllTeams(currentUserId), HttpStatus.OK);
    }

    //3. GET SINGLE TEAM (DashBoard)
    @GetMapping("/{id}")
    public ResponseEntity<TeamDetailDTO> getTeam(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId= currentUser.getUserId();
        return new ResponseEntity<>(service.getTeam(id, currentUserId), HttpStatus.FOUND);
    }

    //4. UPDATE TEAM
    @PutMapping("/{id}")
    public ResponseEntity<Team> updateTeam(
            TeamCreationDTO teamCreationDTO,
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
        return new ResponseEntity<>(service.updateTeam(id,teamCreationDTO, currentUserId), HttpStatus.OK);
    }

    //5. DELETE TEAM
    @DeleteMapping("{id}")
    public ResponseEntity<Void> deleteTeam(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
        service.deleteTeam(id, currentUserId);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

}
