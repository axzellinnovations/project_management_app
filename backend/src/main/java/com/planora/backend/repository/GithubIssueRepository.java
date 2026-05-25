package com.planora.backend.repository;

import com.planora.backend.model.GithubIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GithubIssueRepository extends JpaRepository<GithubIssue, Long> {

    @Query("SELECT i FROM GithubIssue i WHERE i.projectId = :projectId ORDER BY i.createdAt DESC")
    List<GithubIssue> findByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT i FROM GithubIssue i WHERE i.projectId = :projectId AND i.state = :state ORDER BY i.createdAt DESC")
    List<GithubIssue> findByProjectIdAndState(@Param("projectId") Long projectId, @Param("state") String state);

    @Modifying
    @Query("DELETE FROM GithubIssue i WHERE i.projectId = :projectId")
    void deleteAllByProjectId(@Param("projectId") Long projectId);

    @Query("SELECT COUNT(i) FROM GithubIssue i WHERE i.projectId = :projectId AND i.state = 'open'")
    long countOpenByProjectId(@Param("projectId") Long projectId);
}
