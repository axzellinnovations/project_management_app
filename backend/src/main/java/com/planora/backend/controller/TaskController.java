package com.planora.backend.controller;

import com.planora.backend.dto.CommentRequestDTO;
import com.planora.backend.dto.TaskActivityResponseDTO;
import com.planora.backend.dto.TaskRequestDTO;
import com.planora.backend.dto.TaskResponseDTO;
import com.planora.backend.model.Task;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.TaskActivityService;
import com.planora.backend.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "http://localhost:3000")
public class TaskController {

    @Autowired
    TaskService service;

    @Autowired
    TaskActivityService activityService;

    @PostMapping
    public ResponseEntity<TaskResponseDTO> createTask(
            @RequestBody TaskRequestDTO request,
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
        return new ResponseEntity<>(service.createTask(request, currentUserId), HttpStatus.CREATED);
    }

    @GetMapping("/{taskId}")
    public ResponseEntity<TaskResponseDTO> getTaskById(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser){
        if (currentUser != null) {
            service.recordTaskAccess(taskId, currentUser.getUserId());
        }
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
            @PathVariable Long projectId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        return new ResponseEntity<>(service.getTasksByProject(projectId, currentUserId), HttpStatus.OK);
    }

    // DASHBOARD ENDPOINTS

    @PostMapping("/{taskId}/access")
    public ResponseEntity<Void> recordTaskAccess(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser){
        service.recordTaskAccess(taskId, currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @GetMapping("/recent")
    public ResponseEntity<List<TaskResponseDTO>> getRecentTasks(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(defaultValue = "20") int limit){
        return new ResponseEntity<>(service.getRecentTasks(currentUser.getUserId(), limit), HttpStatus.OK);
    }

    @GetMapping("/assigned")
    public ResponseEntity<List<TaskResponseDTO>> getAssignedTasks(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(defaultValue = "20") int limit){
        return new ResponseEntity<>(service.getAssignedTasks(currentUser.getUserId(), limit), HttpStatus.OK);
    }

    @GetMapping("/worked-on")
    public ResponseEntity<List<TaskResponseDTO>> getWorkedOnTasks(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestParam(defaultValue = "20") int limit){
        return new ResponseEntity<>(service.getWorkedOnTasks(currentUser.getUserId(), limit), HttpStatus.OK);
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

    @GetMapping("/{taskId}/comments")
    public ResponseEntity<List<com.planora.backend.dto.CommentResponseDTO>> getComments(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        return new ResponseEntity<>(service.getComments(taskId, currentUser.getUserId()), HttpStatus.OK);
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

    @PatchMapping("/{taskId}/priority")
    public ResponseEntity<TaskResponseDTO> updatePriority(
            @PathVariable Long taskId,
            @RequestBody java.util.Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        String priority = body.get("priority");
        return new ResponseEntity<>(service.updatePriority(taskId, priority, currentUserId), HttpStatus.OK);
    }

    @GetMapping("/{taskId}/activities")
    public ResponseEntity<List<TaskActivityResponseDTO>> getActivities(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        return new ResponseEntity<>(activityService.getActivities(taskId), HttpStatus.OK);
    }
}
