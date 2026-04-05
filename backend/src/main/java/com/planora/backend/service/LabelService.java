package com.planora.backend.service;

import com.planora.backend.dto.LabelRequestDTO;
import com.planora.backend.dto.LabelResponseDTO;
import com.planora.backend.model.Label;
import com.planora.backend.model.Project;
import com.planora.backend.model.TeamRole;
import com.planora.backend.repository.LabelRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class LabelService {

    @Autowired
    private LabelRepository labelRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TeamMemberRepository teamMemberRepository;

    public List<LabelResponseDTO> getProjectLabels(Long projectId, Long currentUserId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new EntityNotFoundException("Project not found"));
        validateMembership(project.getTeam().getId(), currentUserId);
        return labelRepository.findByProjectId(projectId).stream()
                .map(l -> new LabelResponseDTO(l.getId(), l.getName(), l.getColor()))
                .collect(Collectors.toList());
    }

    @Transactional
    public LabelResponseDTO createLabel(LabelRequestDTO request, Long currentUserId) {
        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new EntityNotFoundException("Project not found"));
        validateMembership(project.getTeam().getId(), currentUserId);
        Label label = new Label(request.getName(), request.getColor(), project);
        Label saved = labelRepository.save(label);
        return new LabelResponseDTO(saved.getId(), saved.getName(), saved.getColor());
    }

    @Transactional
    public LabelResponseDTO updateLabel(Long id, LabelRequestDTO request, Long currentUserId) {
        Label label = labelRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Label not found"));
        validateMembership(label.getProject().getTeam().getId(), currentUserId);
        if (request.getName() != null) label.setName(request.getName());
        if (request.getColor() != null) label.setColor(request.getColor());
        Label saved = labelRepository.save(label);
        return new LabelResponseDTO(saved.getId(), saved.getName(), saved.getColor());
    }

    @Transactional
    public void deleteLabel(Long id, Long currentUserId) {
        Label label = labelRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Label not found"));
        validateMembership(label.getProject().getTeam().getId(), currentUserId);
        labelRepository.delete(label);
    }

    private void validateMembership(Long teamId, Long userId) {
        teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new RuntimeException("User is not a member of this project"));
    }
}
