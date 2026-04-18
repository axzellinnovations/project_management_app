package com.planora.backend.service;

import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.Project;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ProjectReportDownloadService {

    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ProjectReportDataService projectReportDataService;
    private final PdfReportBuilder pdfReportBuilder;
    private final ExcelReportBuilder excelReportBuilder;

    public GeneratedReportFile generate(Long projectId, Long userId, String format) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        Long teamId = project.getTeam().getId();
        if (teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId).isEmpty()) {
            throw new ForbiddenException("User is not a member of this project");
        }

        ProjectReportDataService.ReportSnapshot snapshot = projectReportDataService.loadSnapshot(projectId);
        String normalizedFormat = format == null ? "" : format.trim().toUpperCase(Locale.ROOT);
        String safeName = snapshot.project().getName().replaceAll("[^a-zA-Z0-9_-]", "_") + "_Report";

        return switch (normalizedFormat) {
            case "PDF" -> new GeneratedReportFile(
                    pdfReportBuilder.build(snapshot),
                    safeName + ".pdf",
                    MediaType.APPLICATION_PDF
            );
            case "EXCEL" -> new GeneratedReportFile(
                    excelReportBuilder.build(snapshot),
                    safeName + ".xlsx",
                    MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            );
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid report format. Use PDF or EXCEL.");
        };
    }

    public record GeneratedReportFile(byte[] content, String fileName, MediaType contentType) {
    }
}
