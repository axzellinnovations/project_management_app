package com.planora.backend.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.planora.backend.model.TaskAccess;
import com.planora.backend.model.Task;
import com.planora.backend.model.User;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskAccessRepository extends JpaRepository<TaskAccess, Long> {
    Optional<TaskAccess> findByTaskAndUser(Task task, User user);
    
    // For "Recent Tasks" endpoints
    List<TaskAccess> findByUserUserIdOrderByLastAccessedAtDesc(Long userId, Pageable pageable);
}
