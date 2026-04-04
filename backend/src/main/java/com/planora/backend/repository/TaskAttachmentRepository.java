package com.planora.backend.repository;

import com.planora.backend.model.TaskAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskAttachmentRepository extends JpaRepository<TaskAttachment, Long> {
    List<TaskAttachment> findByTaskIdOrderByCreatedAtDesc(Long taskId);

    Optional<TaskAttachment> findByObjectKey(String objectKey);
}
