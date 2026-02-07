package com.planora.backend.service;

import com.planora.backend.model.Project;
import com.planora.backend.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;

    // CREATE Project
    public Project createProject(Project project) {
        return projectRepository.save(project);
    }

    // READ All Projects
    public List<Project> getAllProjects() {
        return projectRepository.findAll();
    }

    // READ Project by ID
    public Project getProjectById(Long id) {
        return projectRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Project not found with id: " + id));
    }

    // UPDATE Project
    public Project updateProject(Long id, Project updatedProject) {
        Project existingProject = getProjectById(id);

        existingProject.setName(updatedProject.getName());
        existingProject.setDescription(updatedProject.getDescription());
        existingProject.setType(updatedProject.getType());

        return projectRepository.save(existingProject);
    }

    // DELETE Project
    public void deleteProject(Long id) {
        Project project = getProjectById(id);
        projectRepository.delete(project);
    }
}
