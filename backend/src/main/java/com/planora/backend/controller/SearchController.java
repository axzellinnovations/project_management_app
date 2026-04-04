package com.planora.backend.controller;

import com.planora.backend.dto.SearchResponseDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public ResponseEntity<List<SearchResponseDTO>> search(
            @RequestParam String query,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(searchService.globalSearch(query, principal.getUserId()));
    }
}
