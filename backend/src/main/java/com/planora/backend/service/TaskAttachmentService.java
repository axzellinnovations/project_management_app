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
    private static final long MAX_FILE_SIZE_BYTES = 25L * 1024 * 1024;
    private static final Duration URL_DURATION = Duration.ofMinutes(15);
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

    @Value("${aws.s3.task-bucket}")
    private String taskBucket;

    @Transactional(readOnly = true)
    public TaskAttachmentUploadInitResponseDTO initUpload(Long taskId, Long userId, TaskAttachmentUploadInitRequestDTO request) {
        Task task = getTask(taskId);
        validateTeamMember(task, userId);
        validateFileRequest(request.getFileName(), request.getContentType(), request.getFileSize());

        String objectKey = buildObjectKey(taskId, request.getFileName());

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
        Task task = getTask(taskId);
        validateTeamMember(task, userId);
        validateFileRequest(request.getFileName(), request.getContentType(), request.getFileSize());
        validateObjectKeyOwnership(taskId, request.getObjectKey());
        s3StorageService.verifyObjectExists(taskBucket, request.getObjectKey());

        // Idempotency: if this objectKey was already finalized, return existing record
        TaskAttachment existing = taskAttachmentRepository.findByObjectKey(request.getObjectKey()).orElse(null);
        if (existing != null) {
            return mapToDTO(existing);
        }

        User uploader = getUser(userId);

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
        Task task = getTask(taskId);
        validateTeamMember(task, userId);

        if (file == null || file.isEmpty()) {
            throw new RuntimeException("File is required");
        }

        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload.bin";
        String resolvedContentType = s3StorageService.resolveContentType(file.getContentType(), fileName);
        validateFileRequest(fileName, resolvedContentType, file.getSize());

        String objectKey = buildObjectKey(taskId, fileName);

        try {
            s3StorageService.putObject(taskBucket, objectKey, resolvedContentType,
                    file.getInputStream(), file.getSize());
        } catch (Exception e) {
            throw new RuntimeException("Could not upload file to S3: " + e.getMessage());
        }

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

        if (!attachment.getTask().getId().equals(taskId)) {
            throw new RuntimeException("Attachment does not belong to this task");
        }

        try {
            s3StorageService.deleteObject(taskBucket, attachment.getObjectKey());
        } catch (Exception e) {
            logger.warn("Failed to delete object from S3 for key {}: {}", attachment.getObjectKey(), e.getMessage());
        }

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

    private void validateTeamMember(Task task, Long userId) {
        Long teamId = task.getProject().getTeam().getId();
        teamMemberRepository.findByTeamIdAndUserUserId(teamId, userId)
                .orElseThrow(() -> new RuntimeException("User is not a member of this project team"));
    }

    /** Task-specific validation: enforces ALLOWED_CONTENT_TYPES and MAX_FILE_SIZE_BYTES. */
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

    private String buildObjectKey(Long taskId, String fileName) {
        String safeName = normalizeFileName(fileName).replace(" ", "_");
        return "task-" + taskId + "/" + UUID.randomUUID() + "-" + safeName;
    }

    private String normalizeFileName(String fileName) {
        String trimmed = fileName.trim();
        String withoutPath = trimmed.replace("\\", "/");
        String nameOnly = withoutPath.substring(withoutPath.lastIndexOf("/") + 1);
        if (nameOnly.isBlank()) {
            throw new RuntimeException("Invalid file name");
        }
        return nameOnly;
    }

    /** Task-specific: ensures the objectKey belongs to this task's S3 prefix. */
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
