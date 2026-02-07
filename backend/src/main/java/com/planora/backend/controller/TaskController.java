package com.planora.backend.controller;

import com.planora.backend.dto.CommentRequestDTO;
import com.planora.backend.dto.TaskRequestDTO;
import com.planora.backend.dto.TaskResponseDTO;
import com.planora.backend.model.Task;
import com.planora.backend.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController("/api/tasks")
@CrossOrigin(origins = "*")
public class TaskController {

    @Autowired
    TaskService service;

    @PostMapping
    public ResponseEntity<TaskResponseDTO> createTask(
            @RequestBody TaskRequestDTO request,
            @RequestParam Long currentUserId){
        return new ResponseEntity<>(service.createTask(request, currentUserId), HttpStatus.CREATED);
    }

    @GetMapping("/{taskId}")
    public ResponseEntity<TaskResponseDTO> getTaskById(
            @PathVariable Long taskId){
        return new ResponseEntity<>(service.getTaskById(taskId), HttpStatus.OK);
    }

    @PutMapping("/{taskId}")
    public ResponseEntity<TaskResponseDTO> updateTask(
            @PathVariable Long taskId,
            @RequestBody TaskRequestDTO request,
            @RequestParam Long currentUserId){
        return new ResponseEntity<>(service.updateTask(taskId, request, currentUserId), HttpStatus.OK);
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> deleteTask(
            @PathVariable Long taskId,
            @RequestParam Long currentUserId){
        service.deleteTask(taskId, currentUserId);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    @GetMapping("/project/{projectId}")
    public ResponseEntity<List<TaskResponseDTO>> getTasksByProject(
            @PathVariable Long projectId
    ){
        return new ResponseEntity<>(service.getTasksByProject(projectId), HttpStatus.OK);
    }

    // SUBTASKS

    @PostMapping("/{parentId}/subtasks")
    public ResponseEntity<TaskResponseDTO> createSubTask(
            @PathVariable Long parentId,
            @RequestBody TaskRequestDTO subTaskRequest,
            @RequestParam Long currentUserId
    ){
        return new ResponseEntity<>(service.createSubTask(parentId, subTaskRequest, currentUserId), HttpStatus.OK);
    }

    @PostMapping("/{taskId}/dependencies/{blockerId}")
    public ResponseEntity<Void> addDependency(
            @PathVariable Long taskId,
            @PathVariable Long blockerId
    ){
        service.addDependency(taskId,blockerId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @DeleteMapping("/{taskId}/dependencies/{blockerId}")
    public ResponseEntity<Void> removeDependency(
            @PathVariable Long taskId,
            @PathVariable Long blockerId
    ){
        service.removeDependency(taskId, blockerId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    //LABEL

    @PostMapping("/{taskId}/label/{labelId}")
    public ResponseEntity<Void> addLabel(
            @PathVariable Long taskId,
            @PathVariable Long labelId
    ){
        service.addLabel(taskId, labelId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @DeleteMapping("/{taskId}/label/{labelId}")
    public ResponseEntity<Void> removeLabel(
            @PathVariable Long taskId,
            @PathVariable Long labelId
    ){
        service.removeLabel(taskId, labelId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    //COMMENTS

    @PostMapping("/{taskId}/comments")
    public ResponseEntity<Void> addComment(
            @PathVariable Long taskId,
            @RequestBody CommentRequestDTO request
            ){
        service.addComment(taskId,request);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    //ASSIGNMENT

    @PatchMapping("{taskID}/assign/{userId}")
    public ResponseEntity<Void> assignUser(
            @PathVariable Long taskID,
            @PathVariable Long userId
    ){
        service.assignUser(taskID,userId);
        return new ResponseEntity<>(HttpStatus.OK);
    }
}
