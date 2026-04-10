package com.planora.backend.repository;

import com.planora.backend.model.TaskTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskTemplateRepository extends JpaRepository<TaskTemplate, Long> {
    List<TaskTemplate> findByProjectIdOrderByCreatedAtDesc(Long projectId);
}
