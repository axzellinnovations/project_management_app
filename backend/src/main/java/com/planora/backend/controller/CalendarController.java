package com.planora.backend.controller;

import com.planora.backend.dto.CalendarEventDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.CalendarService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Provides calendar data for the frontend.
 *
 * Endpoint: GET /api/calendar/events?projectId={projectId}
 */
@RestController
@RequestMapping("/api/calendar")
public class CalendarController {

    private final CalendarService calendarService;

    public CalendarController(CalendarService calendarService) {
        this.calendarService = calendarService;
    }

    /**
     * Returns all tasks and sprints for a project in calendar-friendly format.
     *
     * Example: GET /api/calendar/events?projectId=15
     */
    @GetMapping("/events")
    public ResponseEntity<List<CalendarEventDTO>> getCalendarEvents(
            @RequestParam Long projectId,
            @AuthenticationPrincipal UserPrincipal currentUser) {

        List<CalendarEventDTO> events = calendarService.getCalendarEvents(projectId, currentUser.getUserId());
        return ResponseEntity.ok(events);
    }
}
