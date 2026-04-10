package com.planora.backend.repository;

import com.planora.backend.model.Task;
import com.planora.backend.model.TaskFieldValue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskFieldValueRepository extends JpaRepository<TaskFieldValue, Long> {
    List<TaskFieldValue> findByTask(Task task);
    Optional<TaskFieldValue> findByTaskIdAndCustomFieldId(Long taskId, Long customFieldId);
}
