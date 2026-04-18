package com.planora.backend.service;

import com.planora.backend.model.ScheduledReport;
import com.planora.backend.repository.ScheduledReportRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/**
 * Cron job that runs every 60 seconds and dispatches all ACTIVE scheduled reports
 * whose nextSendAt has elapsed.
 */
@Service
public class ReportEmailScheduler {

    private static final Logger log = LoggerFactory.getLogger(ReportEmailScheduler.class);

    private final ScheduledReportRepository  repo;
    private final ScheduledReportService     service;
    private final JavaMailSenderImpl         mailSender;

    private static final String FROM       = "no-reply@planora.com";
    private static final String APP_BASE   = "http://localhost:3000";

    public ReportEmailScheduler(ScheduledReportRepository repo,
                                 ScheduledReportService     service,
                                 JavaMailSenderImpl         mailSender) {
        this.repo       = repo;
        this.service    = service;
        this.mailSender = mailSender;
    }

    @Scheduled(fixedDelay = 60_000)   // check every 60 seconds
    @Transactional
    public void dispatchDueReports() {
        Instant now = Instant.now();
        List<ScheduledReport> due = repo.findByStatusAndNextSendAtLessThanEqual("ACTIVE", now);

        if (due.isEmpty()) return;

        log.info("[ReportScheduler] {} report(s) due at {}", due.size(), now);

        for (ScheduledReport sr : due) {
            try {
                sendReportEmail(sr);
                service.recordSent(sr);
                log.info("[ReportScheduler] Dispatched report id={} project={}", sr.getId(), sr.getProjectId());
            } catch (Exception e) {
                log.error("[ReportScheduler] Failed to send report id={}: {}", sr.getId(), e.getMessage());
            }
        }
    }

    // ── Email composition ─────────────────────────────────────────────────────

    private void sendReportEmail(ScheduledReport sr) throws MessagingException {
        MimeMessage mime   = mailSender.createMimeMessage();
        MimeMessageHelper h = new MimeMessageHelper(mime, true, "UTF-8");

        h.setFrom(FROM);

        // To
        String[] toArr = splitEmails(sr.getRecipientsTo());
        if (toArr.length == 0) {
            log.warn("[ReportScheduler] No recipients for report id={}, skipping", sr.getId());
            return;
        }
        h.setTo(toArr);

        // CC / BCC
        if (sr.getRecipientsCc() != null && !sr.getRecipientsCc().isBlank()) {
            h.setCc(splitEmails(sr.getRecipientsCc()));
        }
        if (sr.getRecipientsBcc() != null && !sr.getRecipientsBcc().isBlank()) {
            h.setBcc(splitEmails(sr.getRecipientsBcc()));
        }

        // Subject
        String subject = (sr.getSubject() != null && !sr.getSubject().isBlank())
            ? sr.getSubject()
            : "Your scheduled report is ready — Project #" + sr.getProjectId();
        h.setSubject(subject);

        // Body
        String reportUrl = APP_BASE + "/report/" + sr.getProjectId();
        h.setText(buildEmailHtml(sr, reportUrl), true);

        mailSender.send(mime);
    }

    // ── HTML template ──────────────────────────────────────────────────────────

    private String buildEmailHtml(ScheduledReport sr, String reportUrl) {
        String customBody = (sr.getBodyMessage() != null && !sr.getBodyMessage().isBlank())
            ? "<p style='color:#374151;font-size:14px;line-height:1.7;margin:0 0 18px 0;'>"
              + escapeHtml(sr.getBodyMessage()) + "</p>"
            : "";

        String formatLabel = switch (sr.getFormat().toUpperCase()) {
            case "PDF"   -> "PDF Report";
            case "EXCEL" -> "Excel Workbook";
            default      -> "PDF + Excel Report";
        };

        String scheduleLabel = "ONE_TIME".equalsIgnoreCase(sr.getScheduleType())
            ? "One-Time Delivery"
            : "Recurring Delivery";

        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8"/>
              <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
              <title>Your Scheduled Report</title>
            </head>
            <body style="margin:0;padding:0;font-family:'Inter',Arial,sans-serif;background:#F3F4F6;">
              <table width="100%%" cellpadding="0" cellspacing="0">
                <tr><td align="center" style="padding:40px 16px;">
                  <table width="560" cellpadding="0" cellspacing="0"
                         style="background:#ffffff;border-radius:16px;overflow:hidden;
                                box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <tr>
                      <td style="background:linear-gradient(135deg,#155DFC 0%%,#4D8BFF 100%%);
                                 padding:32px 40px;text-align:center;">
                        <p style="margin:0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.75);
                                   letter-spacing:2px;text-transform:uppercase;">Planora</p>
                        <h1 style="margin:12px 0 6px 0;font-size:24px;font-weight:800;color:#ffffff;">
                          Your Report Is Ready
                        </h1>
                        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.80);">%s · Project #%s</p>
                      </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                      <td style="padding:36px 40px;">
                        %s
                        <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 24px 0;">
                          Your scheduled <strong>%s</strong> is ready to download.
                          Click the button below to open the Report Studio and generate your report.
                        </p>

                        <!-- Info pills -->
                        <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                          <tr>
                            <td style="background:#EBF2FF;border-radius:8px;padding:8px 14px;
                                       font-size:12px;font-weight:600;color:#155DFC;margin-right:8px;">
                              📄 %s
                            </td>
                            <td width="8"></td>
                            <td style="background:#F0FDF4;border-radius:8px;padding:8px 14px;
                                       font-size:12px;font-weight:600;color:#16A34A;">
                              🔁 %s
                            </td>
                          </tr>
                        </table>

                        <!-- CTA Button -->
                        <table cellpadding="0" cellspacing="0" style="width:100%%;">
                          <tr>
                            <td align="center">
                              <a href="%s"
                                 style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#155DFC,#4D8BFF);
                                        color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;
                                        border-radius:10px;box-shadow:0 4px 16px rgba(21,93,252,0.35);">
                                Open Report Studio →
                              </a>
                            </td>
                          </tr>
                        </table>

                        <p style="margin:24px 0 0 0;font-size:12px;color:#9CA3AF;text-align:center;">
                          This email was sent automatically by Planora's report scheduler.
                          If you did not set up this schedule, you can ignore this email.
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background:#F9FAFB;padding:20px 40px;text-align:center;
                                 border-top:1px solid #E5E7EB;">
                        <p style="margin:0;font-size:11px;color:#9CA3AF;">
                          © %s Planora · Report Scheduler
                        </p>
                      </td>
                    </tr>

                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(
                scheduleLabel,
                sr.getProjectId(),
                customBody,
                formatLabel,
                formatLabel,
                scheduleLabel,
                reportUrl,
                java.time.Year.now().getValue()
            );
    }

    private String[] splitEmails(String csv) {
        if (csv == null || csv.isBlank()) return new String[0];
        return Arrays.stream(csv.split(","))
                     .map(String::trim)
                     .filter(s -> !s.isBlank())
                     .toArray(String[]::new);
    }

    private String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
