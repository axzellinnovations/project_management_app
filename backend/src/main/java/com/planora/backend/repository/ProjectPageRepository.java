package com.planora.backend.repository;

import com.planora.backend.model.ProjectPage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectPageRepository extends JpaRepository<ProjectPage,Long> {
    //To fetch all pages related to a project
    List<ProjectPage> findByProjectId(Long projectId);
}
