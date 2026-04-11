package com.planora.backend.controller;

import com.planora.backend.dto.GlobalSearchResponseDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.GlobalSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class GlobalSearchController {

    private final GlobalSearchService globalSearchService;

    @GetMapping
    public ResponseEntity<GlobalSearchResponseDTO> search(
            @RequestParam(name = "q") String q,
            @RequestParam(required = false) Long projectId,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (q == null || q.trim().length() < 2) {
            return ResponseEntity.ok(GlobalSearchResponseDTO.builder()
                    .tasks(java.util.List.of())
                    .documents(java.util.List.of())
                    .members(java.util.List.of())
                    .build());
        }

        return ResponseEntity.ok(globalSearchService.search(q, projectId, principal.getUserId()));
    }
}
