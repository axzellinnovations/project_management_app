package com.planora.backend.controller;

import com.planora.backend.dto.CommentRequestDTO;
import com.planora.backend.dto.TaskRequestDTO;
import com.planora.backend.dto.TaskResponseDTO;
import com.planora.backend.model.Task;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "*")
public class TaskController {

    @Autowired
    TaskService service;

    @PostMapping
    public ResponseEntity<TaskResponseDTO> createTask(
            @RequestBody TaskRequestDTO request,
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
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
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
        return new ResponseEntity<>(service.updateTask(taskId, request, currentUserId), HttpStatus.OK);
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> deleteTask(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
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
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        return new ResponseEntity<>(service.createSubTask(parentId, subTaskRequest, currentUserId), HttpStatus.OK);
    }

    @PostMapping("/{taskId}/dependencies/{blockerId}")
    public ResponseEntity<Void> addDependency(
            @PathVariable Long taskId,
            @PathVariable Long blockerId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        service.addDependency(taskId,blockerId,currentUserId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @DeleteMapping("/{taskId}/dependencies/{blockerId}")
    public ResponseEntity<Void> removeDependency(
            @PathVariable Long taskId,
            @PathVariable Long blockerId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        service.removeDependency(taskId, blockerId, currentUserId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    //LABEL

    @PostMapping("/{taskId}/label/{labelId}")
    public ResponseEntity<Void> addLabel(
            @PathVariable Long taskId,
            @PathVariable Long labelId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        service.addLabel(taskId, labelId, currentUserId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @DeleteMapping("/{taskId}/label/{labelId}")
    public ResponseEntity<Void> removeLabel(
            @PathVariable Long taskId,
            @PathVariable Long labelId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        service.removeLabel(taskId, labelId, currentUserId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    //COMMENTS

    @PostMapping("/{taskId}/comments")
    public ResponseEntity<Void> addComment(
            @PathVariable Long taskId,
            @RequestBody CommentRequestDTO request,
            @AuthenticationPrincipal UserPrincipal currentUser
            ){
        Long currentUserId = currentUser.getUserId();
        service.addComment(taskId,request,currentUserId);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    //ASSIGNMENT

    @PatchMapping("{taskID}/assign/{userId}")
    public ResponseEntity<Void> assignUser(
            @PathVariable Long taskID,
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        service.assignUser(taskID,userId,currentUserId);
        return new ResponseEntity<>(HttpStatus.OK);
    }
}
