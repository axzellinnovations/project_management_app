package com.planora.backend.controller;

import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.ProjectReportDownloadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectReportController {

    private final ProjectReportDownloadService projectReportDownloadService;

    @GetMapping("/{projectId}/reports/download")
    public ResponseEntity<byte[]> downloadProjectReport(
            @PathVariable Long projectId,
            @RequestParam String format,
            @AuthenticationPrincipal UserPrincipal principal) {

                if (principal == null) {
                        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
                }

        ProjectReportDownloadService.GeneratedReportFile file =
                projectReportDownloadService.generate(projectId, principal.getUserId(), format);

        String contentDisposition = ContentDisposition.attachment()
                .filename(file.fileName(), StandardCharsets.UTF_8)
                .build()
                .toString();

        return ResponseEntity.ok()
                .contentType(file.contentType())
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition)
                .cacheControl(CacheControl.noStore())
                .body(file.content());
    }
}
