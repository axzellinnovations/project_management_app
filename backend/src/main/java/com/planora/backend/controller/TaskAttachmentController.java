package com.planora.backend.controller;

import com.planora.backend.dto.*;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.TaskAttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/tasks/{taskId}/attachments")
@RequiredArgsConstructor
public class TaskAttachmentController {

    private final TaskAttachmentService taskAttachmentService;

    @PostMapping("/upload/init")
    public ResponseEntity<TaskAttachmentUploadInitResponseDTO> initUpload(
            @PathVariable Long taskId,
            @RequestBody TaskAttachmentUploadInitRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(
                taskAttachmentService.initUpload(taskId, principal.getUserId(), request)
        );
    }

    @PostMapping("/upload/finalize")
    public ResponseEntity<TaskAttachmentResponseDTO> finalizeUpload(
            @PathVariable Long taskId,
            @RequestBody TaskAttachmentUploadFinalizeRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                taskAttachmentService.finalizeUpload(taskId, principal.getUserId(), request),
                HttpStatus.CREATED
        );
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<TaskAttachmentResponseDTO> uploadViaBackend(
            @PathVariable Long taskId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserPrincipal principal) {
        return new ResponseEntity<>(
                taskAttachmentService.uploadViaBackend(taskId, principal.getUserId(), file),
                HttpStatus.CREATED
        );
    }

    @GetMapping
    public ResponseEntity<List<TaskAttachmentResponseDTO>> listAttachments(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(
                taskAttachmentService.listAttachments(taskId, principal.getUserId())
        );
    }

    @DeleteMapping("/{attachmentId}")
    public ResponseEntity<Void> deleteAttachment(
            @PathVariable Long taskId,
            @PathVariable Long attachmentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        taskAttachmentService.deleteAttachment(taskId, attachmentId, principal.getUserId());
        return ResponseEntity.noContent().build();
    }
}
