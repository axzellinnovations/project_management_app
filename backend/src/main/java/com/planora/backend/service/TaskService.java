package com.planora.backend.service;

import com.planora.backend.model.KanbanColumn;
import com.planora.backend.model.Task;
import com.planora.backend.repository.KanbanColumnRepository;
import com.planora.backend.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class TaskService {
    @Autowired
    TaskRepository taskRepo;
    @Autowired
    KanbanColumnRepository columnRepo;

    public Task moveTask(Long taskId, Long targetColumnId, int newPosition) {
        Task task = taskRepo.findById(taskId).orElseThrow();
        KanbanColumn targetCol = columnRepo.findById(targetColumnId).orElseThrow();

        task.setColumn(targetCol);
        task.setPosition(newPosition);
        return taskRepo.save(task);
    }
}