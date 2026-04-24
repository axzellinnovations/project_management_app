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

    /*
     * PHASE 1: Direct-to-S3 Upload
     * The client tells us what file they *want* to upload. We return a temporary,
     * cryptographic URL so they can upload it straight to AWS S3, bypassing our backend.
     */
    @PostMapping("/upload/init")
    public ResponseEntity<TaskAttachmentUploadInitResponseDTO> initUpload(
            @PathVariable Long taskId,
            @RequestBody TaskAttachmentUploadInitRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(
                taskAttachmentService.initUpload(taskId, principal.getUserId(), request)
        );
    }

    /*
     * PHASE 2: Direct-to-S3 Upload
     * The client calls this AFTER the AWS upload succeeds. We verify the file actually
     * made it to S3, and then we save the metadata (filename, size) to our database.
     */
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

    /*
     * FALLBACK UPLOAD: Backend Proxy
     * Used by clients (like older mobile apps or simple scripts) that cannot handle the
     * two-step AWS presigned URL process. The file bytes hit our Spring Boot server,
     * and we stream them to AWS.
     * Note: `consumes = MediaType.MULTIPART_FORM_DATA_VALUE` explicitly tells Spring
     * to expect binary file data, not JSON.
     */
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

    /*
     * Fetches all attachments associated with a specific task.
     * The Service layer will automatically generate fresh, secure download URLs
     * for every attachment in this list.
     */
    @GetMapping
    public ResponseEntity<List<TaskAttachmentResponseDTO>> listAttachments(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(
                taskAttachmentService.listAttachments(taskId, principal.getUserId())
        );
    }

    /*
     * Hard deletes a specific attachment.
     * REST Standard: Returns 204 No Content because the resource is gone and there
     * is no remaining data to send back to the client.
     */
    @DeleteMapping("/{attachmentId}")
    public ResponseEntity<Void> deleteAttachment(
            @PathVariable Long taskId,
            @PathVariable Long attachmentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        taskAttachmentService.deleteAttachment(taskId, attachmentId, principal.getUserId());
        return ResponseEntity.noContent().build();
    }
}
