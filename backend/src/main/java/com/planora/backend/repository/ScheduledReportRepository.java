package com.planora.backend.repository;

import com.planora.backend.model.ScheduledReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface ScheduledReportRepository extends JpaRepository<ScheduledReport, Long> {

    /** Find all ACTIVE reports that are due (nextSendAt <= now). */
    List<ScheduledReport> findByStatusAndNextSendAtLessThanEqual(String status, Instant now);

    /** List all schedules for a given project. */
    List<ScheduledReport> findByProjectIdOrderByCreatedAtDesc(Long projectId);
}
