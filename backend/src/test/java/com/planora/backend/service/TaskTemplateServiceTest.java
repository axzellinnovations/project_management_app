package com.planora.backend.service;

import com.planora.backend.dto.TaskTemplateDTO;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskTemplate;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TaskTemplateRepository;
import com.planora.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskTemplateServiceTest {

    @Mock private TaskTemplateRepository templateRepository;
    @Mock private ProjectRepository projectRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks
    private TaskTemplateService taskTemplateService;

    private Project sampleProject;
    private User sampleUser;
    private TaskTemplate sampleTemplate;

    @BeforeEach
    void setUp() {
        sampleProject = new Project();
        sampleProject.setId(10L);

        sampleUser = new User();
        sampleUser.setUserId(1L);
        sampleUser.setUsername("alice");

        sampleTemplate = new TaskTemplate();
        sampleTemplate.setId(1L);
        sampleTemplate.setProject(sampleProject);
        sampleTemplate.setCreatedBy(sampleUser);
        sampleTemplate.setName("Bug Template");
        sampleTemplate.setTitle("Fix a bug");
    }

    @Test
    void getTemplates_returnsListOfDTOs() {
        when(templateRepository.findByProjectIdOrderByCreatedAtDesc(10L)).thenReturn(List.of(sampleTemplate));

        List<TaskTemplateDTO> result = taskTemplateService.getTemplates(10L);

        assertEquals(1, result.size());
        assertEquals("Bug Template", result.get(0).getName());
    }

    @Test
    void createTemplate_savesAndReturnsDTO() {
        when(projectRepository.findById(10L)).thenReturn(Optional.of(sampleProject));
        when(userRepository.findById(1L)).thenReturn(Optional.of(sampleUser));
        when(templateRepository.save(any())).thenReturn(sampleTemplate);

        TaskTemplateDTO.CreateRequest req = new TaskTemplateDTO.CreateRequest();
        req.setName("Bug Template");
        req.setTitle("Fix a bug");

        TaskTemplateDTO result = taskTemplateService.createTemplate(10L, req, 1L);

        assertEquals("Bug Template", result.getName());
        verify(templateRepository).save(any());
    }

    @Test
    void createTemplate_throwsWhenProjectNotFound() {
        when(projectRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> taskTemplateService.createTemplate(99L, new TaskTemplateDTO.CreateRequest(), 1L));
    }

    @Test
    void createTemplate_throwsWhenUserNotFound() {
        when(projectRepository.findById(10L)).thenReturn(Optional.of(sampleProject));
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> taskTemplateService.createTemplate(10L, new TaskTemplateDTO.CreateRequest(), 99L));
    }

    @Test
    void deleteTemplate_deletesSuccessfully() {
        when(templateRepository.findById(1L)).thenReturn(Optional.of(sampleTemplate));
        doNothing().when(templateRepository).deleteById(1L);

        assertDoesNotThrow(() -> taskTemplateService.deleteTemplate(1L));
        verify(templateRepository).deleteById(1L);
    }

    @Test
    void deleteTemplate_throwsWhenNotFound() {
        when(templateRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> taskTemplateService.deleteTemplate(99L));
    }
}
