package com.planora.backend.service;

import com.planora.backend.dto.*;
import com.planora.backend.model.*;
import com.planora.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import jakarta.persistence.EntityNotFoundException;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TaskAttachmentService {

    private static final Logger logger = LoggerFactory.getLogger(TaskAttachmentService.class);

    // Hard limits to protect AWS billing and server health.
    private static final long MAX_FILE_SIZE_BYTES = 25L * 1024 * 1024;

    // Presigned URLs expire quickly to minimize the attack window if a link is leaked.
    private static final Duration URL_DURATION = Duration.ofMinutes(15);

    // Strict MIME-type whitelist to prevent malicious script/executable uploads.
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp"
    );

    private final TaskAttachmentRepository taskAttachmentRepository;
    private final TaskRepository taskRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final S3StorageService s3StorageService;

    // Distinct from the DMS bucket. Keeping task attachments in their own bucket
    // makes setting up AWS lifecycle rules (like auto-deleting after 1 year) much easier.
    @Value("${aws.s3.task-bucket}")
    private String taskBucket;

    // Generates the cryptographic ticket allowing the frontend to push bytes directly to AWS.
    @Transactional(readOnly = true)
    public TaskAttachmentUploadInitResponseDTO initUpload(Long taskId, Long userId, TaskAttachmentUploadInitRequestDTO request) {
        // Step 1: Validate the task exists and the user is authorized to see it.
        Task task = getTask(taskId);
        validateTeamMember(task, userId);

        // Step 2: Ensure the file isn't too big or a dangerous format.
        validateFileRequest(request.getFileName(), request.getContentType(), request.getFileSize());

        // Step 3: Construct the isolated S3 path.
        String objectKey = buildObjectKey(taskId, request.getFileName());

        // Step 4: Ask our S3 adapter to mint the temporary upload URL.
        String uploadUrl = s3StorageService.generatePresignedUploadUrl(
                taskBucket, objectKey, request.getContentType(), URL_DURATION);

        return TaskAttachmentUploadInitResponseDTO.builder()
                .uploadUrl(uploadUrl)
                .objectKey(objectKey)
                .expiresInSeconds(URL_DURATION.getSeconds())
                .build();
    }

    @Transactional
    public TaskAttachmentResponseDTO finalizeUpload(Long taskId, Long userId, TaskAttachmentUploadFinalizeRequestDTO request) {
        // Step 1: Standard security validations.
        Task task = getTask(taskId);
        validateTeamMember(task, userId);
        validateFileRequest(request.getFileName(), request.getContentType(), request.getFileSize());

        // Step 2: Ensure they aren't trying to attach a file from Task B into Task A.
        validateObjectKeyOwnership(taskId, request.getObjectKey());

        // Step 3: Crucial Check - Ask AWS if the file actually exists.
        // Prevents users from saving fake database records.
        s3StorageService.verifyObjectExists(taskBucket, request.getObjectKey());

        // Step 4: Idempotency. If the frontend had a network retry and sent this twice,
        // just return the existing record instead of crashing or creating duplicates.
        TaskAttachment existing = taskAttachmentRepository.findByObjectKey(request.getObjectKey()).orElse(null);
        if (existing != null) {
            return mapToDTO(existing);
        }

        User uploader = getUser(userId);

        // Step 5: Save the definitive database record.
        TaskAttachment attachment = new TaskAttachment();
        attachment.setTask(task);
        attachment.setFileName(normalizeFileName(request.getFileName()));
        attachment.setContentType(request.getContentType());
        attachment.setFileSize(request.getFileSize());
        attachment.setObjectKey(request.getObjectKey());
        attachment.setUploadedBy(uploader);

        TaskAttachment saved = taskAttachmentRepository.save(attachment);
        return mapToDTO(saved);
    }

    @Transactional
    public TaskAttachmentResponseDTO uploadViaBackend(Long taskId, Long userId, MultipartFile file) {

        // Step 1: Security checks.
        Task task = getTask(taskId);
        validateTeamMember(task, userId);

        if (file == null || file.isEmpty()) {
            throw new RuntimeException("File is required");
        }

        // Step 2: Validate and sanitize the incoming file.
        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.bin";
        String resolvedContentType = s3StorageService.resolveContentType(file.getContentType(), fileName);
        validateFileRequest(fileName, resolvedContentType, file.getSize());

        String objectKey = buildObjectKey(taskId, fileName);

        // Step 3: Stream the bytes from Spring Boot to AWS S3.
        try {
            s3StorageService.putObject(taskBucket, objectKey, resolvedContentType,
                    file.getInputStream(), file.getSize());
        } catch (Exception e) {
            throw new RuntimeException("Could not upload file to S3: " + e.getMessage());
        }

        // Step 4: Code Reuse trick. We build a fake request and pass it to Phase 2
        // so we don't have to duplicate the database save logic.
        TaskAttachmentUploadFinalizeRequestDTO finalizeRequest = new TaskAttachmentUploadFinalizeRequestDTO();
        finalizeRequest.setFileName(fileName);
        finalizeRequest.setContentType(resolvedContentType);
        finalizeRequest.setFileSize(file.getSize());
        finalizeRequest.setObjectKey(objectKey);

        return finalizeUpload(taskId, userId, finalizeRequest);
    }

    @Transactional(readOnly = true)
    public List<TaskAttachmentResponseDTO> listAttachments(Long taskId, Long userId) {
        Task task = getTask(taskId);
        validateTeamMember(task, userId);

        return taskAttachmentRepository.findByTaskIdOrderByCreatedAtDesc(taskId)
                .stream()
                .map(this::mapToDTO)
                .toList();
    }

    @Transactional
    public void deleteAttachment(Long taskId, Long attachmentId, Long userId) {
        Task task = getTask(taskId);
        validateTeamMember(task, userId);

        TaskAttachment attachment = taskAttachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new EntityNotFoundException("Attachment not found"));

        // Security: Ensure the attachment actually belongs to the specified task context.
        if (!attachment.getTask().getId().equals(taskId)) {
            throw new RuntimeException("Attachment does not belong to this task");
        }

        // Step 1: Delete physical bytes from AWS.
        try {
            s3StorageService.deleteObject(taskBucket, attachment.getObjectKey());
        } catch (Exception e) {
            // If AWS fails, log it but continue. We still want to remove it from the UI.
            logger.warn("Failed to delete object from S3 for key {}: {}", attachment.getObjectKey(), e.getMessage());
        }

        // Step 2: Delete logical record from database.
        taskAttachmentRepository.delete(attachment);
    }

    // ── Task-specific helpers ──

    private Task getTask(Long taskId) {
        return taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found"));
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
    }

    // Ensure the user is a member of the project team before letting them view/upload attachments.
    private void validateTeamMember(Task task, Long userId) {
        Long teamId = task.getProject().getTeam().getId();
        teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new RuntimeException("User is not a member of this project team"));
    }

    // Task-specific validation: enforces ALLOWED_CONTENT_TYPES and MAX_FILE_SIZE_BYTES.
    private void validateFileRequest(String fileName, String contentType, Long fileSize) {
        if (fileName == null || fileName.isBlank()) {
            throw new RuntimeException("fileName is required");
        }
        if (contentType == null || contentType.isBlank()) {
            throw new RuntimeException("contentType is required");
        }
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new RuntimeException("Unsupported file type");
        }
        if (fileSize == null || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
            throw new RuntimeException("fileSize must be between 1 byte and 25MB");
        }
    }

    // Scopes the S3 key specifically to the Task ID to prevent cross-contamination.
    private String buildObjectKey(Long taskId, String fileName) {
        String safeName = normalizeFileName(fileName).replace(" ", "_");
        return "task-" + taskId + "/" + UUID.randomUUID() + "-" + safeName;
    }

    // Prevents path traversal attacks (e.g., uploading "../../../etc/passwd").
    private String normalizeFileName(String fileName) {
        String trimmed = fileName.trim();
        String withoutPath = trimmed.replace("\\", "/");
        String nameOnly = withoutPath.substring(withoutPath.lastIndexOf("/") + 1);
        if (nameOnly.isBlank()) {
            throw new RuntimeException("Invalid file name");
        }
        return nameOnly;
    }

    // Task-specific: ensures the objectKey belongs to this task's S3 prefix.
    private void validateObjectKeyOwnership(Long taskId, String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            throw new RuntimeException("objectKey is required");
        }
        String expectedPrefix = "task-" + taskId + "/";
        if (!objectKey.startsWith(expectedPrefix)) {
            throw new RuntimeException("Invalid object key for this task");
        }
    }

    private TaskAttachmentResponseDTO mapToDTO(TaskAttachment attachment) {
        return TaskAttachmentResponseDTO.builder()
                .id(attachment.getId())
                .fileName(attachment.getFileName())
                .contentType(attachment.getContentType())
                .fileSize(attachment.getFileSize())
                .downloadUrl(s3StorageService.generatePresignedDownloadUrl(
                        taskBucket, attachment.getObjectKey(), URL_DURATION))
                .uploadedByName(attachment.getUploadedBy().getUsername())
                .createdAt(attachment.getCreatedAt())
                .build();
    }
}
