package com.planora.backend.service;

import com.planora.backend.dto.CustomFieldDTO;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.CustomField;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskFieldValue;
import com.planora.backend.repository.CustomFieldRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskFieldValueRepository;
import com.planora.backend.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomFieldServiceTest {

    @Mock private CustomFieldRepository customFieldRepository;
    @Mock private TaskFieldValueRepository taskFieldValueRepository;
    @Mock private ProjectRepository projectRepository;
    @Mock private TaskRepository taskRepository;

    @InjectMocks
    private CustomFieldService customFieldService;

    private Project sampleProject;
    private CustomField sampleField;
    private Task sampleTask;

    @BeforeEach
    void setUp() {
        sampleProject = new Project();
        sampleProject.setId(10L);

        sampleField = new CustomField();
        sampleField.setId(1L);
        sampleField.setName("Priority");
        sampleField.setFieldType("SELECT");
        sampleField.setProject(sampleProject);
        sampleField.setPosition(0);

        sampleTask = new Task();
        sampleTask.setId(5L);
    }

    @Test
    void getFieldsForProject_returnsListOfDTOs() {
        when(customFieldRepository.findByProjectIdOrderByPosition(10L)).thenReturn(List.of(sampleField));

        List<CustomFieldDTO> result = customFieldService.getFieldsForProject(10L);

        assertEquals(1, result.size());
        assertEquals("Priority", result.get(0).getName());
        assertEquals("SELECT", result.get(0).getFieldType());
    }

    @Test
    void createField_savesAndReturnsDTO() {
        when(projectRepository.findById(10L)).thenReturn(Optional.of(sampleProject));
        when(customFieldRepository.save(any())).thenReturn(sampleField);

        CustomFieldDTO.UpsertRequest req = new CustomFieldDTO.UpsertRequest();
        req.setName("Priority");
        req.setFieldType("SELECT");
        req.setPosition(0);

        CustomFieldDTO result = customFieldService.createField(10L, req);

        assertEquals("Priority", result.getName());
        verify(customFieldRepository).save(any());
    }

    @Test
    void createField_throwsWhenProjectNotFound() {
        when(projectRepository.findById(99L)).thenReturn(Optional.empty());

        CustomFieldDTO.UpsertRequest req = new CustomFieldDTO.UpsertRequest();
        req.setName("Priority");

        assertThrows(ResourceNotFoundException.class, () -> customFieldService.createField(99L, req));
    }

    @Test
    void updateField_updatesAndReturnsDTO() {
        when(customFieldRepository.findById(1L)).thenReturn(Optional.of(sampleField));
        when(customFieldRepository.save(any())).thenReturn(sampleField);

        CustomFieldDTO.UpsertRequest req = new CustomFieldDTO.UpsertRequest();
        req.setName("Severity");
        req.setFieldType("TEXT");
        req.setPosition(1);

        CustomFieldDTO result = customFieldService.updateField(1L, req);

        assertNotNull(result);
        verify(customFieldRepository).save(sampleField);
    }

    @Test
    void updateField_throwsWhenFieldNotFound() {
        when(customFieldRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> customFieldService.updateField(99L, new CustomFieldDTO.UpsertRequest()));
    }

    @Test
    void deleteField_deletesSuccessfully() {
        when(customFieldRepository.findById(1L)).thenReturn(Optional.of(sampleField));
        doNothing().when(customFieldRepository).deleteById(1L);

        assertDoesNotThrow(() -> customFieldService.deleteField(1L));
        verify(customFieldRepository).deleteById(1L);
    }

    @Test
    void deleteField_throwsWhenNotFound() {
        when(customFieldRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> customFieldService.deleteField(99L));
    }

    @Test
    void setFieldValue_createsNewValueWhenNoneExists() {
        when(taskRepository.findById(5L)).thenReturn(Optional.of(sampleTask));
        when(customFieldRepository.findById(1L)).thenReturn(Optional.of(sampleField));
        when(taskFieldValueRepository.findByTaskIdAndCustomFieldId(5L, 1L)).thenReturn(Optional.empty());
        when(taskFieldValueRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertDoesNotThrow(() -> customFieldService.setFieldValue(5L, 1L, "High"));
        verify(taskFieldValueRepository).save(any());
    }

    @Test
    void setFieldValue_updatesExistingValue() {
        TaskFieldValue existing = new TaskFieldValue(1L, sampleTask, sampleField, "Low");
        when(taskRepository.findById(5L)).thenReturn(Optional.of(sampleTask));
        when(customFieldRepository.findById(1L)).thenReturn(Optional.of(sampleField));
        when(taskFieldValueRepository.findByTaskIdAndCustomFieldId(5L, 1L)).thenReturn(Optional.of(existing));
        when(taskFieldValueRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        customFieldService.setFieldValue(5L, 1L, "High");

        assertEquals("High", existing.getValue());
    }

    @Test
    void getValuesForTask_returnsValueDTOList() {
        TaskFieldValue fv = new TaskFieldValue(1L, sampleTask, sampleField, "High");
        when(taskRepository.findById(5L)).thenReturn(Optional.of(sampleTask));
        when(taskFieldValueRepository.findByTask(sampleTask)).thenReturn(List.of(fv));

        List<CustomFieldDTO.ValueDTO> result = customFieldService.getValuesForTask(5L);

        assertEquals(1, result.size());
        assertEquals("High", result.get(0).getValue());
        assertEquals("Priority", result.get(0).getFieldName());
    }
}
