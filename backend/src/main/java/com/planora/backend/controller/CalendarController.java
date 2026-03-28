package com.planora.backend.controller;

import com.planora.backend.dto.CalendarEventDTO;
import com.planora.backend.service.CalendarService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Provides calendar data for the frontend.
 *
 * Endpoint: GET /api/calendar/events?projectId={projectId}
 */
@RestController
@RequestMapping("/api/calendar")
@CrossOrigin(origins = "http://localhost:3000")
public class CalendarController {

    @Autowired
    private CalendarService calendarService;

    /**
     * Returns all tasks and sprints for a project in calendar-friendly format.
     *
     * Example: GET /api/calendar/events?projectId=15
     */
    @GetMapping("/events")
    public ResponseEntity<List<CalendarEventDTO>> getCalendarEvents(
            @RequestParam Long projectId) {

        List<CalendarEventDTO> events = calendarService.getCalendarEvents(projectId);
        return ResponseEntity.ok(events);
    }
}