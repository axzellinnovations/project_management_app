package com.planora.backend.service;

import com.planora.backend.model.Sprint;
import com.planora.backend.repository.SprintRepository;
import com.planora.backend.security.CurrentUserService;
import com.planora.backend.security.ProjectPermission;
import com.planora.backend.security.ProjectPermissionService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class SprintService {

    private final SprintRepository sprintRepository;
    private final ProjectPermissionService permissionService;
    private final CurrentUserService currentUserService;

    public SprintService(SprintRepository sprintRepository,
                         ProjectPermissionService permissionService,
                         CurrentUserService currentUserService) {
        this.sprintRepository = sprintRepository;
        this.permissionService = permissionService;
        this.currentUserService = currentUserService;
    }

    // CREATE Sprint (Configure Board: OWNER/ADMIN)
    public Sprint createSprint(Sprint sprint) {
        Long userId = currentUserService.getUserId();
        permissionService.require(sprint.getProId(), userId, ProjectPermission.CONFIGURE_BOARD);

        if (sprint.getStartDate() == null || sprint.getEndDate() == null) {
            throw new RuntimeException("Start date and end date are required");
        }
        if (sprint.getStartDate().isAfter(sprint.getEndDate())) {
            throw new RuntimeException("Start date cannot be after end date");
        }

        if (sprint.getStatus() == null || sprint.getStatus().isBlank()) {
            sprint.setStatus("PLANNED");
        }

        return sprintRepository.save(sprint);
    }

    // READ all sprints by project (View Board: OWNER/ADMIN/MEMBER/VIEWER)
    public List<Sprint> getSprintsByProject(Long proId) {
        Long userId = currentUserService.getUserId();
        permissionService.require(proId, userId, ProjectPermission.VIEW_BOARD);

        return sprintRepository.findByProId(proId);
    }

    // READ sprint by ID (View Board)
    public Sprint getSprintById(Long id) {
        Sprint sprint = sprintRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        Long userId = currentUserService.getUserId();
        permissionService.require(sprint.getProId(), userId, ProjectPermission.VIEW_BOARD);

        return sprint;
    }

    // UPDATE sprint (Configure Board: OWNER/ADMIN)
    public Sprint updateSprint(Long id, Sprint updatedSprint) {
        Sprint existingSprint = sprintRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        Long userId = currentUserService.getUserId();
        permissionService.require(existingSprint.getProId(), userId, ProjectPermission.CONFIGURE_BOARD);

        // Optional: prevent editing ACTIVE/COMPLETED sprints (you can remove if not needed)
        // if ("COMPLETED".equalsIgnoreCase(existingSprint.getStatus())) {
        //     throw new RuntimeException("Cannot update a COMPLETED sprint");
        // }

        if (updatedSprint.getName() != null) existingSprint.setName(updatedSprint.getName());
        if (updatedSprint.getStartDate() != null) existingSprint.setStartDate(updatedSprint.getStartDate());
        if (updatedSprint.getEndDate() != null) existingSprint.setEndDate(updatedSprint.getEndDate());
        if (updatedSprint.getStatus() != null) existingSprint.setStatus(updatedSprint.getStatus());

        if (existingSprint.getStartDate() == null || existingSprint.getEndDate() == null) {
            throw new RuntimeException("Start date and end date are required");
        }
        if (existingSprint.getStartDate().isAfter(existingSprint.getEndDate())) {
            throw new RuntimeException("Start date cannot be after end date");
        }

        return sprintRepository.save(existingSprint);
    }

    // DELETE sprint (Configure Board: OWNER/ADMIN)
    public void deleteSprint(Long id) {
        Sprint existing = sprintRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        Long userId = currentUserService.getUserId();
        permissionService.require(existing.getProId(), userId, ProjectPermission.CONFIGURE_BOARD);

        // Optional business rule: don’t delete ACTIVE sprint
        // if ("ACTIVE".equalsIgnoreCase(existing.getStatus())) {
        //     throw new RuntimeException("Cannot delete an ACTIVE sprint");
        // }

        sprintRepository.deleteById(id);
    }

    // START sprint (Configure Board: OWNER/ADMIN)
    public Sprint startSprint(Long sprintId, LocalDate startDate, LocalDate endDate) {
        Sprint sprint = sprintRepository.findById(sprintId)
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        Long userId = currentUserService.getUserId();
        permissionService.require(sprint.getProId(), userId, ProjectPermission.CONFIGURE_BOARD);

        if ("ACTIVE".equalsIgnoreCase(sprint.getStatus())) {
            throw new RuntimeException("Sprint is already ACTIVE");
        }
        if ("COMPLETED".equalsIgnoreCase(sprint.getStatus())) {
            throw new RuntimeException("Cannot start a COMPLETED sprint");
        }

        if (startDate == null || endDate == null) {
            throw new RuntimeException("Start date and end date are required");
        }
        if (startDate.isAfter(endDate)) {
            throw new RuntimeException("Start date cannot be after end date");
        }

        boolean activeExists = sprintRepository.existsByProIdAndStatus(sprint.getProId(), "ACTIVE");
        if (activeExists) {
            throw new RuntimeException("Another sprint is already ACTIVE for this project");
        }

        sprint.setStartDate(startDate);
        sprint.setEndDate(endDate);
        sprint.setStatus("ACTIVE");

        return sprintRepository.save(sprint);
    }
}
