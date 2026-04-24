package com.planora.backend.service;

import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.ColumnText;
import com.lowagie.text.pdf.PdfContentByte;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfGState;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfPageEventHelper;
import com.lowagie.text.pdf.PdfTemplate;
import com.lowagie.text.pdf.PdfWriter;
import com.planora.backend.model.Milestone;
import com.planora.backend.model.Project;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.Task;
import com.planora.backend.model.TeamMember;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Component
public class PdfReportBuilder {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("MMM d, yyyy");

    private static final Color C_BG = new Color(245, 247, 252);
    private static final Color C_INK = new Color(25, 31, 44);
    private static final Color C_MUTED = new Color(106, 118, 140);

    private static final Color C_BRAND = new Color(26, 90, 240);
    private static final Color C_BRAND_DARK = new Color(16, 58, 168);
    private static final Color C_PANEL = new Color(255, 255, 255);
    private static final Color C_BORDER = new Color(223, 229, 242);

    private static final Color C_DONE = new Color(22, 163, 74);
    private static final Color C_IN_PROGRESS = new Color(37, 99, 235);
    private static final Color C_IN_REVIEW = new Color(249, 115, 22);
    private static final Color C_TODO = new Color(107, 114, 128);
    private static final Color C_OVERDUE = new Color(220, 38, 38);

    private static final Color C_URGENT = new Color(185, 28, 28);
    private static final Color C_HIGH = new Color(239, 68, 68);
    private static final Color C_MEDIUM = new Color(245, 158, 11);
    private static final Color C_LOW = new Color(34, 197, 94);

    private static final Font F_COVER_KICKER = new Font(Font.HELVETICA, 8.5f, Font.BOLD, new Color(224, 233, 255));
    private static final Font F_COVER_TITLE = new Font(Font.HELVETICA, 34, Font.BOLD, Color.WHITE);
    private static final Font F_COVER_SUB = new Font(Font.HELVETICA, 10.5f, Font.NORMAL, new Color(226, 235, 255));
    private static final Font F_COVER_META = new Font(Font.HELVETICA, 10f, Font.NORMAL, new Color(214, 227, 255));
    private static final Font F_COVER_BADGE = new Font(Font.HELVETICA, 10f, Font.BOLD, Color.WHITE);

    private static final Font F_SECTION_TITLE = new Font(Font.HELVETICA, 13, Font.BOLD, C_INK);
    private static final Font F_SECTION_SUB = new Font(Font.HELVETICA, 9, Font.NORMAL, C_MUTED);

    private static final Font F_KPI_VALUE = new Font(Font.HELVETICA, 18, Font.BOLD, C_INK);
    private static final Font F_KPI_LABEL = new Font(Font.HELVETICA, 9, Font.NORMAL, C_MUTED);

    private static final Font F_TABLE_HEADER = new Font(Font.HELVETICA, 9, Font.BOLD, Color.WHITE);
    private static final Font F_TABLE_CELL = new Font(Font.HELVETICA, 8, Font.NORMAL, C_INK);

    private static final Font F_FOOTER = new Font(Font.HELVETICA, 7, Font.NORMAL, new Color(195, 205, 226));

    private static final float PAGE_W = PageSize.A4.getWidth();
    private static final float CHART_LEFT_W = 350f;

    public byte[] build(ProjectReportDataService.ReportSnapshot snap) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 34, 34, 34, 28);
            PdfWriter writer = PdfWriter.getInstance(doc, out);
            writer.setPageEvent(new ModernPageEvent(safe(snap.project().getName())));

            doc.open();
            addCoverPage(doc, writer, snap);

            doc.newPage();
            addSummaryPage(doc, writer, snap);

            doc.newPage();
            addTasksSection(doc, snap.tasks());

            if (!snap.sprints().isEmpty()) {
                doc.newPage();
                addSprintsSection(doc, snap.sprints());
            }

            if (!snap.milestones().isEmpty()) {
                doc.newPage();
                addMilestonesSection(doc, snap.milestones());
            }

            doc.newPage();
            addTeamSection(doc, snap.members());

            doc.close();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to build PDF report", e);
        }
    }

    private void addCoverPage(Document doc, PdfWriter writer, ProjectReportDataService.ReportSnapshot snap) {
        Project project = snap.project();
        List<Task> tasks = snap.tasks();

        long total = tasks.size();
        long done = countStatus(tasks, "DONE");
        long overdue = countOverdue(tasks);
        long members = snap.members().size();
        long completionPct = percent(done, total);

        Sprint activeSprint = findCoverSprint(snap.sprints());
        long sprintProgressPct = sprintProgressPercent(activeSprint);

        float pageH = PageSize.A4.getHeight();
        paintCoverBackground(writer, pageH);

        PdfContentByte canvas = writer.getDirectContent();

        drawLogoBlock(canvas, 34f, pageH - 70f);
        drawAbsoluteText(canvas, "Planora - Project Management App", new Font(Font.HELVETICA, 13f, Font.BOLD, new Color(232, 238, 250)), 100f, pageH - 59f, Element.ALIGN_LEFT);

        drawDatePill(canvas, "Generated: " + snap.generatedOn().format(DATE_FMT), PAGE_W - 168f, pageH - 66f, 132f, 30f);

        String coverTitle = trim(safe(project.getName()), 26);
        drawAbsoluteText(canvas, coverTitle, new Font(Font.TIMES_ROMAN, 54f, Font.BOLD, Color.WHITE), 40f, pageH - 178f, Element.ALIGN_LEFT);

        String typeLabel = project.getType() == null
                ? "Project"
                : ("AGILE".equalsIgnoreCase(project.getType().name()) ? "Agile / Scrum" : "Kanban");
        drawAbsoluteText(canvas, typeLabel + "  |  Project Report", new Font(Font.HELVETICA, 16f, Font.NORMAL, new Color(226, 234, 252)), 40f, pageH - 214f, Element.ALIGN_LEFT);

        float containerX = 24f;
        float containerY = 110f;
        float containerW = PAGE_W - 48f;
        float containerH = 400f;
        drawFrostContainer(canvas, containerX, containerY, containerW, containerH);

        float innerX = containerX + 14f;
        float innerW = containerW - 28f;

        float cardGap = 10f;
        float statCardW = (innerW - 3f * cardGap) / 4f;
        float statCardH = 90f;
        float statY = containerY + containerH - statCardH - 22f;

        drawStatCard(canvas, innerX, statY, statCardW, statCardH, new Color(40, 112, 232), String.valueOf(total), "Total Tasks");
        drawStatCard(canvas, innerX + statCardW + cardGap, statY, statCardW, statCardH, new Color(5, 150, 105), String.valueOf(done), "Completed Tasks");
        drawStatCard(canvas, innerX + (statCardW + cardGap) * 2f, statY, statCardW, statCardH, new Color(198, 98, 24), String.valueOf(overdue), "Overdue");
        drawStatCard(canvas, innerX + (statCardW + cardGap) * 3f, statY, statCardW, statCardH, new Color(109, 95, 204), String.valueOf(members), "Members");

        float completionY = statY - 78f;
        drawCompletionCard(canvas, innerX, completionY, innerW, 64f, completionPct);

        float sprintY = completionY - 142f;
        drawActiveSprintPanel(canvas, innerX, sprintY, innerW, 126f, activeSprint, sprintProgressPct);
    }

    private void paintCoverBackground(PdfWriter writer, float pageH) {
        float heroY = pageH - 255f;
        PdfContentByte bg = writer.getDirectContentUnder();

        bg.saveState();
        bg.setColorFill(new Color(226, 232, 241));
        bg.rectangle(0f, 0f, PAGE_W, pageH);
        bg.fill();
        bg.restoreState();

        bg.saveState();
        bg.setColorFill(new Color(12, 44, 103));
        bg.rectangle(0f, heroY, PAGE_W, 255f);
        bg.fill();
        bg.restoreState();

        bg.saveState();
        PdfGState heroOverlay = new PdfGState();
        heroOverlay.setFillOpacity(0.46f);
        bg.setGState(heroOverlay);
        bg.setColorFill(new Color(63, 153, 217));
        bg.moveTo(PAGE_W * 0.52f, heroY + 150f);
        bg.lineTo(PAGE_W, heroY + 255f);
        bg.lineTo(PAGE_W, heroY);
        bg.lineTo(PAGE_W * 0.66f, heroY + 40f);
        bg.closePathFillStroke();
        bg.restoreState();

        bg.saveState();
        PdfGState softGeo = new PdfGState();
        softGeo.setFillOpacity(0.18f);
        bg.setGState(softGeo);
        bg.setColorFill(new Color(192, 222, 255));
        bg.moveTo(PAGE_W * 0.58f, heroY + 20f);
        bg.lineTo(PAGE_W * 0.74f, heroY + 180f);
        bg.lineTo(PAGE_W * 0.9f, heroY + 60f);
        bg.closePathFillStroke();
        bg.restoreState();

        bg.saveState();
        PdfGState watermarkOpacity = new PdfGState();
        watermarkOpacity.setFillOpacity(0.08f);
        bg.setGState(watermarkOpacity);
        bg.setColorFill(new Color(97, 126, 167));
        bg.circle(PAGE_W - 76f, 112f, 120f);
        bg.fill();
        bg.restoreState();

        bg.saveState();
        PdfGState watermarkStrokeOpacity = new PdfGState();
        watermarkStrokeOpacity.setStrokeOpacity(0.12f);
        bg.setGState(watermarkStrokeOpacity);
        bg.setColorStroke(new Color(128, 151, 184));
        bg.setLineWidth(2f);
        bg.circle(PAGE_W - 76f, 112f, 152f);
        bg.stroke();
        bg.restoreState();
    }

    private void drawLogoBlock(PdfContentByte canvas, float x, float yTop) {
        float size = 42f;
        float y = yTop - size;

        canvas.saveState();
        canvas.setColorFill(new Color(20, 56, 131));
        canvas.roundRectangle(x, y, size, size, 8f);
        canvas.fill();
        canvas.restoreState();

        drawAbsoluteText(canvas, "RPT", new Font(Font.HELVETICA, 14f, Font.BOLD, Color.WHITE), x + size / 2f, y + 15f, Element.ALIGN_CENTER);
    }

    private void drawDatePill(PdfContentByte canvas, String text, float x, float y, float w, float h) {
        canvas.saveState();
        canvas.setColorFill(new Color(124, 157, 193));
        canvas.roundRectangle(x, y, w, h, 14f);
        canvas.fill();
        canvas.restoreState();

        canvas.saveState();
        PdfGState strokeOpacity = new PdfGState();
        strokeOpacity.setStrokeOpacity(0.4f);
        canvas.setGState(strokeOpacity);
        canvas.setColorStroke(new Color(214, 228, 248));
        canvas.setLineWidth(1f);
        canvas.roundRectangle(x, y, w, h, 14f);
        canvas.stroke();
        canvas.restoreState();

        drawAbsoluteText(canvas, text, new Font(Font.HELVETICA, 11f, Font.NORMAL, Color.WHITE), x + w / 2f, y + 10f, Element.ALIGN_CENTER);
    }

    private void drawFrostContainer(PdfContentByte canvas, float x, float y, float w, float h) {
        canvas.saveState();
        PdfGState shadowOpacity = new PdfGState();
        shadowOpacity.setFillOpacity(0.22f);
        canvas.setGState(shadowOpacity);
        canvas.setColorFill(new Color(116, 138, 170));
        canvas.roundRectangle(x + 4f, y - 4f, w, h, 16f);
        canvas.fill();
        canvas.restoreState();

        canvas.saveState();
        canvas.setColorFill(new Color(232, 238, 247));
        canvas.roundRectangle(x, y, w, h, 16f);
        canvas.fill();
        canvas.restoreState();

        canvas.saveState();
        canvas.setColorStroke(new Color(248, 251, 255));
        canvas.setLineWidth(1f);
        canvas.roundRectangle(x, y, w, h, 16f);
        canvas.stroke();
        canvas.restoreState();
    }

    private void drawStatCard(PdfContentByte canvas, float x, float y, float w, float h, Color accent, String value, String label) {
        canvas.saveState();
        PdfGState s = new PdfGState();
        s.setFillOpacity(0.14f);
        canvas.setGState(s);
        canvas.setColorFill(new Color(107, 120, 140));
        canvas.roundRectangle(x + 1.5f, y - 2f, w, h, 8f);
        canvas.fill();
        canvas.restoreState();

        canvas.saveState();
        canvas.setColorFill(Color.WHITE);
        canvas.roundRectangle(x, y, w, h, 8f);
        canvas.fill();
        canvas.restoreState();

        canvas.saveState();
        canvas.setColorStroke(new Color(194, 208, 228));
        canvas.setLineWidth(1f);
        canvas.roundRectangle(x, y, w, h, 8f);
        canvas.stroke();
        canvas.restoreState();

        canvas.saveState();
        canvas.setColorFill(accent);
        canvas.roundRectangle(x, y + h - 4f, w, 4f, 3f);
        canvas.fill();
        canvas.restoreState();

        drawAbsoluteText(canvas, value, new Font(Font.HELVETICA, 24f, Font.BOLD, accent), x + w / 2f, y + h - 47f, Element.ALIGN_CENTER);
        drawAbsoluteText(canvas, label, new Font(Font.HELVETICA, 10.5f, Font.NORMAL, new Color(58, 68, 83)), x + w / 2f, y + 14f, Element.ALIGN_CENTER);
    }

    private void drawCompletionCard(PdfContentByte canvas, float x, float y, float w, float h, long completionPct) {
        canvas.saveState();
        canvas.setColorFill(Color.WHITE);
        canvas.roundRectangle(x, y, w, h, 8f);
        canvas.fill();
        canvas.restoreState();

        canvas.saveState();
        canvas.setColorStroke(new Color(208, 217, 232));
        canvas.setLineWidth(1f);
        canvas.roundRectangle(x, y, w, h, 8f);
        canvas.stroke();
        canvas.restoreState();

        drawAbsoluteText(canvas, "Project Completion", new Font(Font.HELVETICA, 12f, Font.BOLD, C_INK), x + 10f, y + h - 18f, Element.ALIGN_LEFT);
        drawAbsoluteText(canvas, completionPct + "% of 100%", new Font(Font.HELVETICA, 12f, Font.NORMAL, C_INK), x + w - 10f, y + h - 18f, Element.ALIGN_RIGHT);

        float barX = x + 12f;
        float barY = y + 14f;
        float barW = w - 24f;
        float barH = 14f;

        canvas.saveState();
        canvas.setColorFill(new Color(226, 232, 242));
        canvas.roundRectangle(barX, barY, barW, barH, 7f);
        canvas.fill();
        canvas.restoreState();

        float fillW = Math.max(0f, Math.min(1f, completionPct / 100f)) * barW;
        if (fillW > 0f) {
            canvas.saveState();
            canvas.setColorFill(new Color(243, 184, 26));
            canvas.roundRectangle(barX, barY, fillW, barH, 7f);
            canvas.fill();
            canvas.restoreState();
        }

        float markerX = barX + fillW;
        markerX = Math.max(barX + 8f, Math.min(barX + barW - 8f, markerX));

        canvas.saveState();
        canvas.setColorFill(Color.WHITE);
        canvas.circle(markerX, barY + barH / 2f, 15f);
        canvas.fill();
        canvas.restoreState();

        canvas.saveState();
        canvas.setColorStroke(new Color(231, 178, 35));
        canvas.setLineWidth(3f);
        canvas.circle(markerX, barY + barH / 2f, 13.5f);
        canvas.stroke();
        canvas.restoreState();

        drawAbsoluteText(canvas, completionPct + "%", new Font(Font.HELVETICA, 10f, Font.BOLD, C_INK), markerX, barY + barH / 2f - 3f, Element.ALIGN_CENTER);
    }

    private void drawActiveSprintPanel(PdfContentByte canvas, float x, float y, float w, float h, Sprint sprint, long sprintProgressPct) {
        canvas.saveState();
        canvas.setColorFill(new Color(234, 239, 247));
        canvas.roundRectangle(x, y, w, h, 10f);
        canvas.fill();
        canvas.restoreState();

        canvas.saveState();
        canvas.setColorStroke(new Color(206, 218, 236));
        canvas.setLineWidth(1f);
        canvas.roundRectangle(x, y, w, h, 10f);
        canvas.stroke();
        canvas.restoreState();

        String title;
        String dateRange;
        if (sprint == null) {
            title = "Active Sprint: Not Available";
            dateRange = "No sprint information available";
        } else {
            title = "Active Sprint: " + trim(safe(sprint.getName()), 32);
            dateRange = date(sprint.getStartDate()) + " to " + date(sprint.getEndDate());
        }

        drawAbsoluteText(canvas, title, new Font(Font.HELVETICA, 16f, Font.BOLD, new Color(28, 86, 173)), x + 14f, y + h - 24f, Element.ALIGN_LEFT);
        drawAbsoluteText(canvas, dateRange, new Font(Font.HELVETICA, 10f, Font.NORMAL, C_INK), x + 14f, y + h - 48f, Element.ALIGN_LEFT);

        float pillW = 62f;
        float pillH = 24f;
        float pillX = x + w - pillW - 16f;
        float pillY = y + 54f;
        canvas.saveState();
        canvas.setColorFill(new Color(186, 232, 199));
        canvas.roundRectangle(pillX, pillY, pillW, pillH, 10f);
        canvas.fill();
        canvas.restoreState();
        drawAbsoluteText(canvas, "ACTIVE", new Font(Font.HELVETICA, 10f, Font.BOLD, new Color(21, 112, 62)), pillX + pillW / 2f, pillY + 8f, Element.ALIGN_CENTER);

        float lineX = x + 14f;
        float lineY = y + 34f;
        float lineW = w - 28f;

        canvas.saveState();
        canvas.setColorFill(new Color(192, 204, 223));
        canvas.roundRectangle(lineX, lineY, lineW, 8f, 4f);
        canvas.fill();
        canvas.restoreState();

        float sprintFill = Math.max(0f, Math.min(1f, sprintProgressPct / 100f)) * lineW;
        if (sprintFill > 0f) {
            canvas.saveState();
            canvas.setColorFill(new Color(54, 189, 125));
            canvas.roundRectangle(lineX, lineY, sprintFill, 8f, 4f);
            canvas.fill();
            canvas.restoreState();
        }

        float dotX = lineX + sprintFill;
        dotX = Math.max(lineX + 5f, Math.min(lineX + lineW - 5f, dotX));
        canvas.saveState();
        canvas.setColorFill(new Color(54, 189, 125));
        canvas.circle(dotX, lineY + 4f, 6f);
        canvas.fill();
        canvas.restoreState();

        String startLabel = sprint != null && sprint.getStartDate() != null ? String.valueOf(sprint.getStartDate().getDayOfMonth()) : "Start";
        String endLabel = sprint != null && sprint.getEndDate() != null ? String.valueOf(sprint.getEndDate().getDayOfMonth()) : "End";

        drawAbsoluteText(canvas, startLabel, new Font(Font.HELVETICA, 10f, Font.NORMAL, C_INK), lineX, lineY - 16f, Element.ALIGN_LEFT);
        drawAbsoluteText(canvas, String.valueOf(sprintProgressPct), new Font(Font.HELVETICA, 10f, Font.NORMAL, C_INK), dotX, lineY - 16f, Element.ALIGN_CENTER);
        drawAbsoluteText(canvas, endLabel, new Font(Font.HELVETICA, 10f, Font.NORMAL, C_INK), lineX + lineW, lineY - 16f, Element.ALIGN_RIGHT);
    }

    private Sprint findCoverSprint(List<Sprint> sprints) {
        for (Sprint sprint : sprints) {
            if (sprint.getStatus() != null && "ACTIVE".equalsIgnoreCase(sprint.getStatus().name())) {
                return sprint;
            }
        }
        return sprints.isEmpty() ? null : sprints.get(0);
    }

    private long sprintProgressPercent(Sprint sprint) {
        if (sprint == null || sprint.getStartDate() == null || sprint.getEndDate() == null) {
            return 0;
        }
        LocalDate start = sprint.getStartDate();
        LocalDate end = sprint.getEndDate();
        if (end.isBefore(start)) {
            return 0;
        }

        long totalDays = ChronoUnit.DAYS.between(start, end) + 1;
        if (totalDays <= 0) {
            return 0;
        }

        long elapsed = ChronoUnit.DAYS.between(start, LocalDate.now()) + 1;
        if (elapsed < 0) {
            elapsed = 0;
        }
        if (elapsed > totalDays) {
            elapsed = totalDays;
        }

        return Math.round((elapsed * 100.0) / totalDays);
    }

    private void drawAbsoluteText(PdfContentByte canvas, String text, Font font, float x, float y, int align) {
        ColumnText.showTextAligned(canvas, align, new Phrase(text, font), x, y, 0f);
    }

    private void addSummaryPage(Document doc, PdfWriter writer, ProjectReportDataService.ReportSnapshot snap)
            throws DocumentException {
        List<Task> tasks = snap.tasks();

        long total = tasks.size();
        long done = countStatus(tasks, "DONE");
        long inProgress = countStatus(tasks, "IN_PROGRESS");
        long inReview = countStatus(tasks, "IN_REVIEW");
        long todo = countStatus(tasks, "TODO");
        long overdue = countOverdue(tasks);

        long urgent = countPriority(tasks, "URGENT");
        long high = countPriority(tasks, "HIGH");
        long medium = countPriority(tasks, "MEDIUM");
        long low = countPriority(tasks, "LOW");

        doc.add(sectionHeader("Summary Intelligence", "Visual distributions and completion diagnostics"));

        doc.add(buildKpiCards(new Metric[] {
                new Metric("Done", String.valueOf(done)),
                new Metric("In Progress", String.valueOf(inProgress)),
                new Metric("In Review", String.valueOf(inReview)),
                new Metric("To Do", String.valueOf(todo)),
                new Metric("Overdue", String.valueOf(overdue))
        }));

        List<ChartItem> statusItems = List.of(
                new ChartItem("Done", done, C_DONE),
                new ChartItem("In Progress", inProgress, C_IN_PROGRESS),
                new ChartItem("In Review", inReview, C_IN_REVIEW),
                new ChartItem("To Do", todo, C_TODO),
                new ChartItem("Overdue", overdue, C_OVERDUE)
        );

        List<ChartItem> priorityItems = List.of(
                new ChartItem("Urgent", urgent, C_URGENT),
                new ChartItem("High", high, C_HIGH),
                new ChartItem("Medium", medium, C_MEDIUM),
                new ChartItem("Low", low, C_LOW)
        );

        Image statusChart = buildHorizontalBarChart(
                writer,
                "Task Status Distribution",
                "Counts and percentages from live task states",
                statusItems,
                total,
                CHART_LEFT_W,
                178f
        );

        Image priorityChart = buildHorizontalBarChart(
                writer,
                "Priority Distribution",
                "Urgency mix across the current backlog",
                priorityItems,
                total,
                CHART_LEFT_W,
                160f
        );

        long remaining = Math.max(total - done, 0);
        long completionPct = percent(done, total);

        Image donut = buildCompletionDonutChart(
                writer,
                done,
                remaining,
                completionPct,
                180f,
                240f
        );

        PdfPTable grid = new PdfPTable(new float[] {2.15f, 1f});
        grid.setWidthPercentage(100);
        grid.setSpacingBefore(10f);

        PdfPCell left = new PdfPCell();
        left.setBorder(Rectangle.NO_BORDER);
        left.setPaddingRight(8f);
        left.addElement(statusChart);
        Paragraph gap = new Paragraph(" ");
        gap.setSpacingBefore(4f);
        gap.setSpacingAfter(4f);
        left.addElement(gap);
        left.addElement(priorityChart);

        PdfPCell right = new PdfPCell();
        right.setBorder(Rectangle.NO_BORDER);
        right.setPaddingLeft(8f);
        right.addElement(donut);
        right.addElement(buildDonutLegend(done, remaining, total));

        grid.addCell(left);
        grid.addCell(right);

        doc.add(grid);
    }

    private void addTasksSection(Document doc, List<Task> tasks) throws DocumentException {
        doc.add(sectionHeader("Task Ledger", "Complete task registry with operational metadata"));

        PdfPTable table = new PdfPTable(new float[] {0.6f, 3.2f, 1.4f, 1.2f, 1.6f, 1.3f, 1.3f, 0.8f});
        table.setWidthPercentage(100);
        table.setHeaderRows(1);

        addHeaderRow(table, "#", "Title", "Status", "Priority", "Assignee", "Due", "Completed", "Pts");

        int idx = 1;
        for (Task task : tasks) {
            Color rowBg = (idx % 2 == 0) ? new Color(251, 253, 255) : Color.WHITE;
            addDataRow(table, rowBg,
                    String.valueOf(idx++),
                    trim(safe(task.getTitle()), 64),
                    normalizeStatus(task.getStatus()),
                    task.getPriority() != null ? task.getPriority().name() : "-",
                    trim(assigneeName(task), 26),
                    date(task.getDueDate()),
                    task.getCompletedAt() != null ? task.getCompletedAt().toLocalDate().format(DATE_FMT) : "-",
                    String.valueOf(task.getStoryPoint())
            );
        }

        doc.add(table);
    }

    private void addSprintsSection(Document doc, List<Sprint> sprints) throws DocumentException {
        doc.add(sectionHeader("Sprint Timeline", "Rhythm, durations and goal alignment"));

        PdfPTable table = new PdfPTable(new float[] {2.4f, 1.2f, 1.4f, 1.4f, 3.2f});
        table.setWidthPercentage(100);
        table.setHeaderRows(1);

        addHeaderRow(table, "Sprint", "Status", "Start", "End", "Goal");

        int idx = 0;
        for (Sprint sprint : sprints) {
            Color rowBg = (idx++ % 2 == 0) ? Color.WHITE : new Color(251, 253, 255);
            addDataRow(table, rowBg,
                    trim(safe(sprint.getName()), 42),
                    sprint.getStatus() != null ? sprint.getStatus().name() : "-",
                    date(sprint.getStartDate()),
                    date(sprint.getEndDate()),
                    trim(safe(sprint.getGoal()), 90)
            );
        }

        doc.add(table);
    }

    private void addMilestonesSection(Document doc, List<Milestone> milestones) throws DocumentException {
        doc.add(sectionHeader("Milestone Board", "Strategic checkpoints and delivery states"));

        PdfPTable table = new PdfPTable(new float[] {3f, 1.4f, 1.4f, 3.2f});
        table.setWidthPercentage(100);
        table.setHeaderRows(1);

        addHeaderRow(table, "Milestone", "Status", "Due", "Description");

        int idx = 0;
        for (Milestone milestone : milestones) {
            Color rowBg = (idx++ % 2 == 0) ? Color.WHITE : new Color(251, 253, 255);
            addDataRow(table, rowBg,
                    trim(safe(milestone.getName()), 46),
                    trim(safe(milestone.getStatus()), 16),
                    date(milestone.getDueDate()),
                    trim(safe(milestone.getDescription()), 100)
            );
        }

        doc.add(table);
    }

    private void addTeamSection(Document doc, List<TeamMember> members) throws DocumentException {
        doc.add(sectionHeader("Team Directory", "Ownership, communication and role visibility"));

        PdfPTable table = new PdfPTable(new float[] {2.6f, 3.4f, 1.4f});
        table.setWidthPercentage(100);
        table.setHeaderRows(1);

        addHeaderRow(table, "Name", "Email", "Role");

        int idx = 0;
        for (TeamMember member : members) {
            Color rowBg = (idx++ % 2 == 0) ? Color.WHITE : new Color(251, 253, 255);
            String name = member.getUser() != null ? safe(member.getUser().getUsername()) : "-";
            String email = member.getUser() != null && member.getUser().getEmail() != null
                    ? member.getUser().getEmail()
                    : "-";
            String role = member.getRole() != null ? member.getRole().name() : "-";

            addDataRow(table, rowBg,
                    trim(name, 36),
                    trim(safe(email), 56),
                    trim(role, 16)
            );
        }

        doc.add(table);
    }

    private PdfPTable sectionHeader(String title, String subtitle) {
        PdfPTable table = new PdfPTable(1);
        table.setWidthPercentage(100);
        table.setSpacingBefore(2f);
        table.setSpacingAfter(8f);

        PdfPCell cell = new PdfPCell();
        cell.setBorderColor(C_BORDER);
        cell.setBorderWidth(1f);
        cell.setPaddingTop(10f);
        cell.setPaddingBottom(10f);
        cell.setPaddingLeft(12f);
        cell.setPaddingRight(12f);
        cell.setBackgroundColor(C_PANEL);

        Paragraph t = new Paragraph(title, F_SECTION_TITLE);
        t.setSpacingAfter(2f);
        cell.addElement(t);
        cell.addElement(new Paragraph(subtitle, F_SECTION_SUB));

        table.addCell(cell);
        return table;
    }

    private PdfPTable buildKpiCards(Metric[] metrics) {
        PdfPTable table = new PdfPTable(metrics.length);
        table.setWidthPercentage(100);
        table.setSpacingBefore(4f);
        table.setSpacingAfter(6f);

        for (Metric metric : metrics) {
            PdfPCell card = new PdfPCell();
            card.setBorderColor(C_BORDER);
            card.setBorderWidth(1f);
            card.setBackgroundColor(C_PANEL);
            card.setPaddingTop(12f);
            card.setPaddingBottom(10f);
            card.setPaddingLeft(10f);
            card.setPaddingRight(10f);
            card.setHorizontalAlignment(Element.ALIGN_LEFT);

            Paragraph value = new Paragraph(metric.value, F_KPI_VALUE);
            value.setSpacingAfter(4f);
            card.addElement(value);
            card.addElement(new Paragraph(metric.label, F_KPI_LABEL));
            table.addCell(card);
        }

        return table;
    }

    private Image buildHorizontalBarChart(
            PdfWriter writer,
            String title,
            String subtitle,
            List<ChartItem> items,
            long total,
            float width,
            float height
    ) {
        try {
            PdfTemplate template = writer.getDirectContent().createTemplate(width, height);
            BaseFont bf = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);

            drawPanel(template, 0, 0, width, height, C_PANEL, C_BORDER);
            drawText(template, bf, 11f, C_INK, 12f, height - 18f, title, Element.ALIGN_LEFT);
            drawText(template, bf, 8f, C_MUTED, 12f, height - 30f, subtitle, Element.ALIGN_LEFT);

            float top = height - 48f;
            float rowHeight = 22f;
            float gap = 8f;

            float labelX = 12f;
            float barX = 108f;
            float barW = width - barX - 56f;

            int idx = 0;
            for (ChartItem item : items) {
                float y = top - idx * (rowHeight + gap);
                if (y < 18f) {
                    break;
                }

                drawText(template, bf, 8.2f, C_INK, labelX, y + 7f, trim(item.label, 18), Element.ALIGN_LEFT);

                drawRect(template, barX, y, barW, rowHeight - 4f, new Color(238, 242, 250), null);

                float ratio = total <= 0 ? 0f : (float) item.value / (float) total;
                float fill = Math.max(0f, Math.min(1f, ratio)) * barW;
                if (fill > 0f) {
                    drawRect(template, barX, y, fill, rowHeight - 4f, item.color, null);
                }

                long pct = percent(item.value, total);
                drawText(template, bf, 8.2f, C_MUTED, barX + barW + 4f, y + 7f, item.value + " (" + pct + "%)", Element.ALIGN_LEFT);
                idx++;
            }

            return Image.getInstance(template);
        } catch (Exception e) {
            throw new RuntimeException("Failed to render bar chart", e);
        }
    }

    private Image buildCompletionDonutChart(
            PdfWriter writer,
            long completed,
            long remaining,
            long completionPct,
            float width,
            float height
    ) {
        try {
            PdfTemplate template = writer.getDirectContent().createTemplate(width, height);
            BaseFont bf = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED);

            drawPanel(template, 0, 0, width, height, C_PANEL, C_BORDER);

            drawText(template, bf, 11f, C_INK, 12f, height - 18f, "Completion", Element.ALIGN_LEFT);
            drawText(template, bf, 8f, C_MUTED, 12f, height - 30f, "Done vs remaining scope", Element.ALIGN_LEFT);

            float cx = width / 2f;
            float cy = height / 2f + 6f;
            float radius = 52f;
            float thickness = 16f;

            template.saveState();
            template.setLineWidth(thickness);
            template.setLineCap(PdfContentByte.LINE_CAP_ROUND);

            template.setColorStroke(new Color(233, 238, 247));
            template.arc(cx - radius, cy - radius, cx + radius, cy + radius, 0f, 360f);
            template.stroke();

            if (completionPct > 0) {
                float extent = Math.max(2f, Math.min(360f, 360f * completionPct / 100f));
                template.setColorStroke(C_BRAND);
                template.arc(cx - radius, cy - radius, cx + radius, cy + radius, 90f, -extent);
                template.stroke();
            }
            template.restoreState();

            drawText(template, bf, 20f, C_INK, cx, cy + 6f, completionPct + "%", Element.ALIGN_CENTER);
            drawText(template, bf, 8.2f, C_MUTED, cx, cy - 10f, "Completed", Element.ALIGN_CENTER);

            drawText(template, bf, 8.2f, C_INK, 20f, 26f, "Done: " + completed, Element.ALIGN_LEFT);
            drawText(template, bf, 8.2f, C_INK, 20f, 14f, "Remaining: " + remaining, Element.ALIGN_LEFT);

            return Image.getInstance(template);
        } catch (Exception e) {
            throw new RuntimeException("Failed to render donut chart", e);
        }
    }

    private PdfPTable buildDonutLegend(long done, long remaining, long total) {
        PdfPTable legend = new PdfPTable(1);
        legend.setWidthPercentage(100);
        legend.setSpacingBefore(6f);

        legend.addCell(legendRow("Total Tasks", String.valueOf(total)));
        legend.addCell(legendRow("Completed", String.valueOf(done)));
        legend.addCell(legendRow("Remaining", String.valueOf(remaining)));

        return legend;
    }

    private PdfPCell legendRow(String label, String value) {
        PdfPTable row = new PdfPTable(new float[] {2f, 1f});
        row.setWidthPercentage(100);

        PdfPCell left = new PdfPCell(new Phrase(label, new Font(Font.HELVETICA, 8.2f, Font.NORMAL, C_MUTED)));
        left.setBorder(Rectangle.NO_BORDER);
        left.setPaddingTop(1f);
        left.setPaddingBottom(1f);

        PdfPCell right = new PdfPCell(new Phrase(value, new Font(Font.HELVETICA, 8.4f, Font.BOLD, C_INK)));
        right.setHorizontalAlignment(Element.ALIGN_RIGHT);
        right.setBorder(Rectangle.NO_BORDER);
        right.setPaddingTop(1f);
        right.setPaddingBottom(1f);

        row.addCell(left);
        row.addCell(right);

        PdfPCell wrap = new PdfPCell(row);
        wrap.setBorder(Rectangle.NO_BORDER);
        wrap.setPaddingTop(1f);
        wrap.setPaddingBottom(1f);
        return wrap;
    }

    private void addHeaderRow(PdfPTable table, String... headers) {
        for (String header : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(header, F_TABLE_HEADER));
            cell.setBackgroundColor(C_BRAND);
            cell.setBorderColor(new Color(66, 132, 255));
            cell.setBorderWidth(0.7f);
            cell.setPaddingTop(6f);
            cell.setPaddingBottom(6f);
            cell.setPaddingLeft(6f);
            table.addCell(cell);
        }
    }

    private void addDataRow(PdfPTable table, Color bg, String... values) {
        for (String value : values) {
            PdfPCell cell = new PdfPCell(new Phrase(value != null ? value : "-", F_TABLE_CELL));
            cell.setBackgroundColor(bg);
            cell.setBorderColor(C_BORDER);
            cell.setBorderWidth(0.7f);
            cell.setPaddingTop(5f);
            cell.setPaddingBottom(5f);
            cell.setPaddingLeft(6f);
            table.addCell(cell);
        }
    }

    private static void drawPanel(PdfTemplate t, float x, float y, float w, float h, Color fill, Color border) {
        t.saveState();
        if (fill != null) {
            t.setColorFill(fill);
        }
        if (border != null) {
            t.setColorStroke(border);
            t.setLineWidth(1f);
        }
        t.roundRectangle(x, y, w, h, 10f);
        if (fill != null && border != null) {
            t.fillStroke();
        } else if (fill != null) {
            t.fill();
        } else if (border != null) {
            t.stroke();
        }
        t.restoreState();
    }

    private static void drawRect(PdfTemplate t, float x, float y, float w, float h, Color fill, Color border) {
        t.saveState();
        if (fill != null) {
            t.setColorFill(fill);
        }
        if (border != null) {
            t.setColorStroke(border);
            t.setLineWidth(1f);
        }
        t.rectangle(x, y, w, h);
        if (fill != null && border != null) {
            t.fillStroke();
        } else if (fill != null) {
            t.fill();
        } else if (border != null) {
            t.stroke();
        }
        t.restoreState();
    }

    private static void drawText(PdfTemplate template, BaseFont bf, float size, Color color, float x, float y, String text, int align) {
        template.saveState();
        template.beginText();
        template.setFontAndSize(bf, size);
        template.setColorFill(color);
        template.endText();

        ColumnText.showTextAligned(
                template,
                align,
                new Phrase(text, new Font(bf, size, Font.NORMAL, color)),
                x,
                y,
                0f
        );
        template.restoreState();
    }

    private long countStatus(List<Task> tasks, String status) {
        long count = 0;
        for (Task task : tasks) {
            String s = task.getStatus();
            if (s != null && status.equalsIgnoreCase(s.trim())) {
                count++;
            }
        }
        return count;
    }

    private long countPriority(List<Task> tasks, String priority) {
        long count = 0;
        for (Task task : tasks) {
            if (task.getPriority() != null && priority.equalsIgnoreCase(task.getPriority().name())) {
                count++;
            }
        }
        return count;
    }

    private long countOverdue(List<Task> tasks) {
        long count = 0;
        for (Task task : tasks) {
            if (isOverdue(task)) {
                count++;
            }
        }
        return count;
    }

    private boolean isOverdue(Task task) {
        return task.getDueDate() != null
                && task.getDueDate().isBefore(LocalDate.now())
                && !"DONE".equalsIgnoreCase(normalizeStatus(task.getStatus()));
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "-";
        }
        String cleaned = status.trim().toUpperCase();
        return switch (cleaned) {
            case "IN_PROGRESS" -> "In Progress";
            case "IN_REVIEW" -> "In Review";
            case "TODO" -> "To Do";
            case "DONE" -> "Done";
            default -> cleaned.replace('_', ' ');
        };
    }

    private String assigneeName(Task task) {
        if (task.getAssignee() == null || task.getAssignee().getUser() == null) {
            return "Unassigned";
        }
        String username = task.getAssignee().getUser().getUsername();
        return username != null && !username.isBlank() ? safe(username) : "Unassigned";
    }

    private String date(LocalDate date) {
        return date == null ? "-" : date.format(DATE_FMT);
    }

    private long percent(long value, long total) {
        if (total <= 0) {
            return 0;
        }
        return Math.round((value * 100.0) / total);
    }

    private String safe(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("[^\\x00-\\xFF]", "?");
    }

    private String trim(String value, int maxLen) {
        if (value == null) {
            return "";
        }
        if (value.length() <= maxLen) {
            return value;
        }
        if (maxLen < 4) {
            return value.substring(0, maxLen);
        }
        return value.substring(0, maxLen - 3) + "...";
    }

    private record Metric(String label, String value) {
    }

    private record ChartItem(String label, long value, Color color) {
    }

    private static class ModernPageEvent extends PdfPageEventHelper {
        private final String projectName;

        private ModernPageEvent(String projectName) {
            this.projectName = projectName;
        }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            if (writer.getPageNumber() == 1) {
                return;
            }

            PdfContentByte cb = writer.getDirectContentUnder();
            cb.saveState();
            cb.setColorFill(C_BG);
            cb.rectangle(0, 0, PAGE_W, PageSize.A4.getHeight());
            cb.fill();
            cb.restoreState();

            PdfContentByte top = writer.getDirectContent();
            top.saveState();
            top.setColorFill(C_BRAND);
            top.rectangle(0, PageSize.A4.getHeight() - 10, PAGE_W, 10);
            top.fill();
            top.restoreState();

            PdfContentByte footer = writer.getDirectContent();
            footer.saveState();
            footer.setColorFill(new Color(20, 29, 48));
            footer.rectangle(0, 0, PAGE_W, 20);
            footer.fill();
            footer.restoreState();

            String right = "Page " + writer.getPageNumber();
            String left = "Planora Modern Report | " + projectName;

            ColumnText.showTextAligned(footer, Element.ALIGN_LEFT, new Phrase(left, F_FOOTER), 34, 7, 0);
            ColumnText.showTextAligned(footer, Element.ALIGN_RIGHT, new Phrase(right, F_FOOTER), PAGE_W - 34, 7, 0);
        }
    }
}
