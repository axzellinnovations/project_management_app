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
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import jakarta.persistence.EntityNotFoundException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
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
    private final S3Presigner s3Presigner;
    private final S3Client s3Client;

    @Value("${aws.s3.task-bucket}")
    private String taskBucket;

    @Transactional(readOnly = true)
    public TaskAttachmentUploadInitResponseDTO initUpload(Long taskId, Long userId, TaskAttachmentUploadInitRequestDTO request) {
        Task task = getTask(taskId);
        validateTeamMember(task, userId);
        validateFileRequest(request.getFileName(), request.getContentType(), request.getFileSize());

        String objectKey = buildObjectKey(taskId, request.getFileName());

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(taskBucket)
                .key(objectKey)
                .contentType(request.getContentType())
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(URL_DURATION)
                .putObjectRequest(putObjectRequest)
                .build();

        String uploadUrl = s3Presigner.presignPutObject(presignRequest).url().toString();

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
        verifyObjectExists(request.getObjectKey());

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
        String resolvedContentType = resolveContentType(file.getContentType(), fileName);
        validateFileRequest(fileName, resolvedContentType, file.getSize());

        String objectKey = buildObjectKey(taskId, fileName);

        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(taskBucket)
                    .key(objectKey)
                    .contentType(resolvedContentType)
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
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
            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(taskBucket)
                    .key(attachment.getObjectKey())
                    .build();
            s3Client.deleteObject(deleteObjectRequest);
        } catch (Exception e) {
            logger.warn("Failed to delete object from S3 for key {}: {}", attachment.getObjectKey(), e.getMessage());
        }

        taskAttachmentRepository.delete(attachment);
    }

    // ── Helpers ──

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

    private void validateObjectKeyOwnership(Long taskId, String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            throw new RuntimeException("objectKey is required");
        }
        String expectedPrefix = "task-" + taskId + "/";
        if (!objectKey.startsWith(expectedPrefix)) {
            throw new RuntimeException("Invalid object key for this task");
        }
    }

    private void verifyObjectExists(String objectKey) {
        try {
            HeadObjectRequest headObjectRequest = HeadObjectRequest.builder()
                    .bucket(taskBucket)
                    .key(objectKey)
                    .build();
            s3Client.headObject(headObjectRequest);
        } catch (NoSuchKeyException e) {
            throw new RuntimeException("File not found in storage. Please re-upload.");
        } catch (Exception e) {
            logger.warn("Could not verify object existence for key {}: {}", objectKey, e.getMessage());
        }
    }

    private String generateDownloadUrl(String objectKey) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(taskBucket)
                .key(objectKey)
                .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(URL_DURATION)
                .getObjectRequest(getObjectRequest)
                .build();

        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    private String resolveContentType(String contentType, String fileName) {
        if (contentType != null && !contentType.isBlank() && !"application/octet-stream".equalsIgnoreCase(contentType)) {
            return contentType;
        }

        String extension = "";
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex >= 0 && dotIndex < fileName.length() - 1) {
            extension = fileName.substring(dotIndex + 1).toLowerCase();
        }

        Map<String, String> mimeMap = Map.ofEntries(
                Map.entry("pdf", "application/pdf"),
                Map.entry("doc", "application/msword"),
                Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                Map.entry("xls", "application/vnd.ms-excel"),
                Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
                Map.entry("txt", "text/plain"),
                Map.entry("jpeg", "image/jpeg"),
                Map.entry("jpg", "image/jpeg"),
                Map.entry("png", "image/png"),
                Map.entry("gif", "image/gif"),
                Map.entry("webp", "image/webp")
        );

        return mimeMap.getOrDefault(extension, "application/octet-stream");
    }

    private TaskAttachmentResponseDTO mapToDTO(TaskAttachment attachment) {
        return TaskAttachmentResponseDTO.builder()
                .id(attachment.getId())
                .fileName(attachment.getFileName())
                .contentType(attachment.getContentType())
                .fileSize(attachment.getFileSize())
                .downloadUrl(generateDownloadUrl(attachment.getObjectKey()))
                .uploadedByName(attachment.getUploadedBy().getUsername())
                .createdAt(attachment.getCreatedAt())
                .build();
    }
}
