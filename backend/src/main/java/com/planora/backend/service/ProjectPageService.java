package com.planora.backend.service;

import com.planora.backend.dto.PageDetailResponseDto;
import com.planora.backend.dto.PageRequestDto;
import com.planora.backend.dto.PageSummaryResponseDto;
import com.planora.backend.model.ProjectPage;
import com.planora.backend.repository.ProjectPageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProjectPageService {

    private final ProjectPageRepository repository;

    public ProjectPage createPage(Long projectId, PageRequestDto request) {
        ProjectPage page = ProjectPage.builder()
                .projectId(projectId)
                .title(request.getTitle())
                .content(request.getContent())
                .build();

        return repository.save(page);
    }

    public List<PageSummaryResponseDto> getProjectPages(Long projectId) {
        return repository.findByProjectId(projectId).stream().map(page ->{
            PageSummaryResponseDto dto = new PageSummaryResponseDto();
            dto.setId(page.getId());
            dto.setTitle(page.getTitle());
            return dto;
        }).collect(Collectors.toList());
    }

    public PageDetailResponseDto getPageById(Long pageId) {
        ProjectPage page = repository.findById(pageId)
                .orElseThrow(() -> new RuntimeException("Page not found"));

        PageDetailResponseDto dto = new PageDetailResponseDto();
        dto.setId(page.getId());
        dto.setTitle(page.getTitle());
        dto.setContent(page.getContent());
        dto.setUpdatedAt(page.getUpdatedAt().toString());

        return dto;
    }

    public PageDetailResponseDto updatePage(Long pageId, PageRequestDto request) {
        ProjectPage existingPage = repository.findById(pageId)
                .orElseThrow(() -> new RuntimeException("Page not found with ID: " + pageId));

        existingPage.setTitle(request.getTitle());
        existingPage.setContent(request.getContent());

        ProjectPage updatedPage = repository.save(existingPage);

        PageDetailResponseDto dto = new PageDetailResponseDto();
        dto.setId(updatedPage.getId());
        dto.setTitle(updatedPage.getTitle());
        dto.setContent(updatedPage.getContent());

        if (updatedPage.getUpdatedAt() != null) {
            dto.setUpdatedAt(updatedPage.getUpdatedAt().toString());
        }

        return dto;
    }

    public void deletePage(Long pageId) {
        ProjectPage existingPage = repository.findById(pageId)
                .orElseThrow(() -> new RuntimeException("Page not found with ID: " + pageId));

        repository.delete(existingPage);
    }
}
