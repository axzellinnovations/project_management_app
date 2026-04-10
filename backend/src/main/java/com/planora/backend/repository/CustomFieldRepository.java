package com.planora.backend.repository;

import com.planora.backend.model.CustomField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CustomFieldRepository extends JpaRepository<CustomField, Long> {
    List<CustomField> findByProjectIdOrderByPosition(Long projectId);
}
