package com.planora.backend.controller;

import com.planora.backend.dto.CommentRequestDTO;
import com.planora.backend.dto.TaskActivityResponseDTO;
import com.planora.backend.dto.TaskRequestDTO;
import com.planora.backend.dto.TaskResponseDTO;
import com.planora.backend.dto.TaskTemplateDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.TaskActivityService;
import com.planora.backend.service.TaskService;
import com.planora.backend.service.TaskTemplateService;
import jakarta.validation.Valid;
import jakarta.validation.groups.Default;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;


import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    @Autowired
    TaskService service;

    @Autowired
    TaskActivityService activityService;

    @Autowired
    TaskTemplateService templateService;

    @Autowired
    SimpMessagingTemplate messagingTemplate;

    @PostMapping
    public ResponseEntity<TaskResponseDTO> createTask(
            @Validated({TaskRequestDTO.OnCreate.class, Default.class}) @RequestBody TaskRequestDTO request,
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
        TaskResponseDTO task = service.createTask(request, currentUserId);
        messagingTemplate.convertAndSend(
                "/topic/project/" + task.getProjectId() + "/tasks",
                Map.of("type", "TASK_CREATED", "task", task));
        return new ResponseEntity<>(task, HttpStatus.CREATED);
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
            @Validated @RequestBody TaskRequestDTO request,
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
        TaskResponseDTO task = service.updateTask(taskId, request, currentUserId);
        messagingTemplate.convertAndSend(
                "/topic/project/" + task.getProjectId() + "/tasks",
                Map.of("type", "TASK_UPDATED", "task", task));
        return new ResponseEntity<>(task, HttpStatus.OK);
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> deleteTask(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser){
        Long currentUserId = currentUser.getUserId();
        Long projectId = service.deleteTask(taskId, currentUserId);
        messagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/tasks",
                Map.of("type", "TASK_DELETED", "taskId", taskId));
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    @GetMapping("/project/{projectId}")
    public ResponseEntity<List<TaskResponseDTO>> getTasksByProject(
            @PathVariable Long projectId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long assigneeId,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Long sprintId,
            @RequestParam(required = false) Long milestoneId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        return new ResponseEntity<>(service.getTasksByProject(projectId, currentUserId, status, assigneeId, priority, sprintId, milestoneId), HttpStatus.OK);
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
            @Validated({TaskRequestDTO.OnCreate.class, Default.class}) @RequestBody TaskRequestDTO subTaskRequest,
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
            @Valid @RequestBody CommentRequestDTO request,
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

    @DeleteMapping("/{taskId}/assignee")
    public ResponseEntity<Void> unassignTask(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        service.unassignTask(taskId, currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    // BULK OPERATIONS

    @PatchMapping("/bulk/status")
    public ResponseEntity<Void> bulkUpdateStatus(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        @SuppressWarnings("unchecked")
        List<Integer> rawIds = (List<Integer>) body.get("taskIds");
        List<Long> taskIds = rawIds.stream().map(i -> i.longValue()).toList();
        String status = (String) body.get("status");
        service.bulkUpdateStatus(taskIds, status, currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @DeleteMapping("/bulk")
    public ResponseEntity<Void> bulkDelete(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        @SuppressWarnings("unchecked")
        List<Integer> rawIds = (List<Integer>) body.get("taskIds");
        List<Long> taskIds = rawIds.stream().map(i -> i.longValue()).toList();
        service.bulkDelete(taskIds, currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
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

    /**
     * PATCH /api/tasks/{taskId}/status
     * Lightweight endpoint for Kanban drag-and-drop status changes.
     * Accepts { "status": "IN_PROGRESS" }.
     */
    @PatchMapping("/{taskId}/status")
    public ResponseEntity<TaskResponseDTO> updateStatus(
            @PathVariable Long taskId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        Long currentUserId = currentUser.getUserId();
        String status = body.get("status");
        TaskResponseDTO task = service.updateStatus(taskId, status, currentUserId);
        messagingTemplate.convertAndSend(
                "/topic/project/" + task.getProjectId() + "/tasks",
                Map.of("type", "TASK_UPDATED", "task", task));
        return new ResponseEntity<>(task, HttpStatus.OK);
    }

    /**
     * PATCH /api/tasks/{taskId}/dates
     * Lightweight endpoint for calendar drag-and-drop date updates.
     * Accepts { startDate: "YYYY-MM-DD", dueDate: "YYYY-MM-DD" }.
     */
    @PatchMapping("/{taskId}/dates")
    public ResponseEntity<Void> patchTaskDates(
            @PathVariable Long taskId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        LocalDate startDate = body.containsKey("startDate") && body.get("startDate") != null && !body.get("startDate").trim().isEmpty()
                ? LocalDate.parse(body.get("startDate")) : null;
        LocalDate dueDate = body.containsKey("dueDate") && body.get("dueDate") != null && !body.get("dueDate").trim().isEmpty()
                ? LocalDate.parse(body.get("dueDate")) : null;
        service.patchTaskDates(taskId, startDate, dueDate, currentUser.getUserId());
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    @GetMapping("/{taskId}/activities")
    public ResponseEntity<List<TaskActivityResponseDTO>> getActivities(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal currentUser
    ){
        return new ResponseEntity<>(activityService.getActivities(taskId), HttpStatus.OK);
    }

    /** Save the task as a reusable template for the project. */
    @PostMapping("/{taskId}/save-as-template")
    public ResponseEntity<TaskTemplateDTO> saveAsTemplate(
            @PathVariable Long taskId,
            @RequestBody TaskTemplateDTO.SaveFromTaskRequest req,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        TaskTemplateDTO dto = templateService.saveTaskAsTemplate(taskId, req.getTemplateName(), currentUser.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    /** PATCH /api/tasks/{taskId}/assignees — replace the multi-assignee list without requiring a full task body. */
    @PatchMapping("/{taskId}/assignees")
    public ResponseEntity<TaskResponseDTO> updateAssignees(
            @PathVariable Long taskId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal currentUser
    ) {
        @SuppressWarnings("unchecked")
        List<Integer> rawIds = (List<Integer>) body.get("assigneeIds");
        List<Long> assigneeIds = rawIds == null ? List.of() : rawIds.stream().map(Integer::longValue).toList();
        TaskResponseDTO task = service.updateAssignees(taskId, assigneeIds, currentUser.getUserId());
        messagingTemplate.convertAndSend(
                "/topic/project/" + task.getProjectId() + "/tasks",
                Map.of("type", "TASK_UPDATED", "task", task));
        return ResponseEntity.ok(task);
    }
}
