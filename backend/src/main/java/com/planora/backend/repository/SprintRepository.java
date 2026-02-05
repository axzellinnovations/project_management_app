package com.planora.backend.repository;

import com.planora.backend.model.Sprint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SprintRepository extends JpaRepository<Sprint, Long> {

    List<Sprint> findByProId(Long proId);
}
