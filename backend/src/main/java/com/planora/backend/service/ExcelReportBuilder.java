package com.planora.backend.service;

import com.planora.backend.model.Milestone;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.Task;
import com.planora.backend.model.TeamMember;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Generates an Excel (.xlsx) project report attachment server-side using Apache POI.
 */
@Component
public class ExcelReportBuilder {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMM d, yyyy");

    public byte[] build(ProjectReportDataService.ReportSnapshot snap) {
        try (XSSFWorkbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Styles s = new Styles(wb);

            buildSummarySheet(wb, s, snap);
            buildTasksSheet(wb, s, snap.tasks());
            buildSprintsSheet(wb, s, snap.sprints());
            buildMilestonesSheet(wb, s, snap.milestones());
            buildMembersSheet(wb, s, snap.members());

            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to build Excel report", e);
        }
    }

    // ── Sheet builders ────────────────────────────────────────────────────────

    private void buildSummarySheet(XSSFWorkbook wb, Styles s,
                                   ProjectReportDataService.ReportSnapshot snap) {
        Sheet sh = wb.createSheet("Summary");
        sh.setColumnWidth(0, 30 * 256);
        sh.setColumnWidth(1, 22 * 256);

        int r = 0;
        row(sh, r++, s.title,  span -> span, snap.project().getName() + " - Project Report");
        row(sh, r++, s.header, span -> span, "Generated On", snap.generatedOn().format(DATE_FMT));
        r++;

        List<Task> tasks = snap.tasks();
        long total     = tasks.size();
        long done      = tasks.stream().filter(t -> "DONE".equalsIgnoreCase(t.getStatus())).count();
        long inProg    = tasks.stream().filter(t -> "IN_PROGRESS".equalsIgnoreCase(t.getStatus())).count();
        long inReview  = tasks.stream().filter(t -> "IN_REVIEW".equalsIgnoreCase(t.getStatus())).count();
        long todo      = tasks.stream().filter(t -> "TODO".equalsIgnoreCase(t.getStatus())).count();
        long overdue   = tasks.stream().filter(t -> isOverdue(t)).count();
        long pct       = total == 0 ? 0 : Math.round(100.0 * done / total);

        row(sh, r++, s.header, span -> span, "Metric", "Value");
        row(sh, r++, s.even,   span -> span, "Total Tasks",       String.valueOf(total));
        row(sh, r++, s.odd,    span -> span, "Completed (Done)",  String.valueOf(done));
        row(sh, r++, s.even,   span -> span, "In Progress",       String.valueOf(inProg));
        row(sh, r++, s.odd,    span -> span, "In Review",         String.valueOf(inReview));
        row(sh, r++, s.even,   span -> span, "To Do",             String.valueOf(todo));
        row(sh, r++, s.odd,    span -> span, "Overdue Tasks",     String.valueOf(overdue));
        row(sh, r++, s.even,   span -> span, "Completion Rate",   pct + "%");
        row(sh, r++, s.odd,    span -> span, "Total Sprints",     String.valueOf(snap.sprints().size()));
        row(sh, r++, s.even,   span -> span, "Total Milestones",  String.valueOf(snap.milestones().size()));
        row(sh, r,   s.odd,    span -> span, "Team Members",      String.valueOf(snap.members().size()));
    }

    private void buildTasksSheet(XSSFWorkbook wb, Styles s, List<Task> tasks) {
        Sheet sh = wb.createSheet("Tasks");
        sh.setColumnWidth(0, 6 * 256);
        sh.setColumnWidth(1, 40 * 256);
        sh.setColumnWidth(2, 16 * 256);
        sh.setColumnWidth(3, 16 * 256);
        sh.setColumnWidth(4, 24 * 256);
        sh.setColumnWidth(5, 14 * 256);
        sh.setColumnWidth(6, 14 * 256);
        sh.setColumnWidth(7, 14 * 256);
        sh.setColumnWidth(8, 8 * 256);

        row(sh, 0, s.header, span -> span,
            "#", "Title", "Status", "Priority", "Assignee",
            "Start Date", "Due Date", "Completed At", "Pts");

        int r = 1;
        for (Task t : tasks) {
            CellStyle cs = r % 2 == 0 ? s.even : s.odd;
            row(sh, r++, cs, span -> span,
                String.valueOf(r - 1),
                t.getTitle(),
                t.getStatus() != null ? t.getStatus() : "",
                t.getPriority() != null ? t.getPriority().name() : "",
                assigneeName(t),
                t.getStartDate()   != null ? t.getStartDate().format(DATE_FMT)   : "",
                t.getDueDate()     != null ? t.getDueDate().format(DATE_FMT)     : "",
                t.getCompletedAt() != null ? t.getCompletedAt().toLocalDate().format(DATE_FMT) : "",
                String.valueOf(t.getStoryPoint())
            );
        }
        sh.setAutoFilter(new CellRangeAddress(0, 0, 0, 8));
    }

    private void buildSprintsSheet(XSSFWorkbook wb, Styles s, List<Sprint> sprints) {
        Sheet sh = wb.createSheet("Sprints");
        sh.setColumnWidth(0, 30 * 256);
        sh.setColumnWidth(1, 14 * 256);
        sh.setColumnWidth(2, 14 * 256);
        sh.setColumnWidth(3, 14 * 256);
        sh.setColumnWidth(4, 30 * 256);

        row(sh, 0, s.header, span -> span, "Sprint Name", "Status", "Start Date", "End Date", "Goal");

        int r = 1;
        for (Sprint sp : sprints) {
            CellStyle cs = r % 2 == 0 ? s.even : s.odd;
            row(sh, r++, cs, span -> span,
                sp.getName(),
                sp.getStatus() != null ? sp.getStatus().name() : "",
                sp.getStartDate() != null ? sp.getStartDate().format(DATE_FMT) : "",
                sp.getEndDate()   != null ? sp.getEndDate().format(DATE_FMT)   : "",
                sp.getGoal() != null ? sp.getGoal() : ""
            );
        }
    }

    private void buildMilestonesSheet(XSSFWorkbook wb, Styles s, List<Milestone> milestones) {
        Sheet sh = wb.createSheet("Milestones");
        sh.setColumnWidth(0, 36 * 256);
        sh.setColumnWidth(1, 16 * 256);
        sh.setColumnWidth(2, 16 * 256);
        sh.setColumnWidth(3, 40 * 256);

        row(sh, 0, s.header, span -> span, "Milestone Name", "Status", "Due Date", "Description");

        int r = 1;
        for (Milestone m : milestones) {
            CellStyle cs = r % 2 == 0 ? s.even : s.odd;
            row(sh, r++, cs, span -> span,
                m.getName(),
                m.getStatus() != null ? m.getStatus() : "",
                m.getDueDate() != null ? m.getDueDate().format(DATE_FMT) : "",
                m.getDescription() != null ? m.getDescription() : ""
            );
        }
    }

    private void buildMembersSheet(XSSFWorkbook wb, Styles s, List<TeamMember> members) {
        Sheet sh = wb.createSheet("Team Members");
        sh.setColumnWidth(0, 30 * 256);
        sh.setColumnWidth(1, 30 * 256);
        sh.setColumnWidth(2, 16 * 256);

        row(sh, 0, s.header, span -> span, "Name", "Email", "Role");

        int r = 1;
        for (TeamMember m : members) {
            CellStyle cs = r % 2 == 0 ? s.even : s.odd;
            row(sh, r++, cs, span -> span,
                m.getUser() != null ? m.getUser().getUsername() : "",
                m.getUser() != null && m.getUser().getEmail() != null ? m.getUser().getEmail() : "",
                m.getRole() != null ? m.getRole().name() : ""
            );
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void row(Sheet sh, int rowIdx, CellStyle cs,
                     java.util.function.UnaryOperator<CellStyle> ignored, String... vals) {
        Row r = sh.createRow(rowIdx);
        r.setHeightInPoints(18);
        for (int i = 0; i < vals.length; i++) {
            Cell c = r.createCell(i);
            c.setCellValue(vals[i]);
            c.setCellStyle(cs);
        }
    }

    private boolean isOverdue(Task t) {
        return t.getDueDate() != null
            && t.getDueDate().isBefore(LocalDate.now())
            && !"DONE".equalsIgnoreCase(t.getStatus());
    }

    private String assigneeName(Task t) {
        if (t.getAssignee() != null && t.getAssignee().getUser() != null) {
            return t.getAssignee().getUser().getUsername();
        }
        return "";
    }

    // ── Style factory ─────────────────────────────────────────────────────────
    private static class Styles {
        final CellStyle title, header, even, odd;

        Styles(XSSFWorkbook wb) {
            Font titleFont = wb.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            titleFont.setColor(IndexedColors.DARK_BLUE.getIndex());

            Font headerFont = wb.createFont();
            headerFont.setBold(true);
            headerFont.setFontHeightInPoints((short) 11);
            headerFont.setColor(IndexedColors.WHITE.getIndex());

            Font bodyFont = wb.createFont();
            bodyFont.setFontHeightInPoints((short) 10);

            title = wb.createCellStyle();
            title.setFont(titleFont);
            title.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
            title.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            title.setBorderBottom(BorderStyle.THIN);
            title.setBottomBorderColor(IndexedColors.GREY_50_PERCENT.getIndex());

            header = wb.createCellStyle();
            header.setFont(headerFont);
            header.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            header.setAlignment(HorizontalAlignment.LEFT);
            header.setVerticalAlignment(VerticalAlignment.CENTER);

            even = wb.createCellStyle();
            even.setFont(bodyFont);
            even.setFillForegroundColor(IndexedColors.WHITE.getIndex());
            even.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            even.setVerticalAlignment(VerticalAlignment.CENTER);
            even.setBorderBottom(BorderStyle.HAIR);
            even.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());

            odd = wb.createCellStyle();
            odd.setFont(bodyFont);
            odd.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex());
            odd.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            odd.setVerticalAlignment(VerticalAlignment.CENTER);
            odd.setBorderBottom(BorderStyle.HAIR);
            odd.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        }
    }
}
