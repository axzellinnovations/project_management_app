package com.planora.backend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Year;

@Service
public class EmailService {

    private final JavaMailSenderImpl mailSender;

    public EmailService(JavaMailSenderImpl mailSender) {
        this.mailSender = mailSender;
    }

    private String getOtpEmailTemplate(String otp) {
        try {
            ClassPathResource resource = new ClassPathResource("templates/otp-template.html");
            String template = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
            return template.replace("{{OTP_CODE}}", otp);
        } catch (IOException e) {
            // Fallback plaintext if template fails
            return "Your verification code is: " + otp + "\n\nThis code will expire in 10 minutes.";
        }
    }

    public void sendVerificationEmail(String toEmail, String otp) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom("no-reply@planora.com");
            helper.setTo(toEmail);
            helper.setSubject("Planora - Your Verification Code");

            String htmlContent = getOtpEmailTemplate(otp);
            helper.setText(htmlContent, true); // true indicates HTML content

            mailSender.send(message);
        } catch (MessagingException e) {
            e.printStackTrace();
        }
    }

    public void sendPasswordResetRequest(String toEmail, String otp) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom("no-reply@planora.com");
            helper.setTo(toEmail);
            helper.setSubject("Planora - Password Reset Code");

            String htmlContent = getOtpEmailTemplate(otp);
            helper.setText(htmlContent, true); // true indicates HTML content

            mailSender.send(message);
        } catch (MessagingException e) {
            e.printStackTrace();
        }
    }

    public void sendProjectInvitationEmail(String toEmail, String inviterName, String projectName) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("no-reply@planora.com");
        message.setTo(toEmail);
        message.setSubject("Planora - Project Invitation");
        message.setText(
                "Hi,\n\n" +
                        "You have been invited to the project \"" + projectName + "\" by " + inviterName + ".\n\n" +
                        "If you did not expect this invitation, you can ignore this email.\n\n" +
                        "Planora Team");
        mailSender.send(message);
    }

    // ✅ Redesigned HTML Email Method
    public void sendProjectInvitationHtmlEmail(String toEmail, String inviterName, String projectName, String token) {
        try {
            String html = loadTemplate("templates/invite_email.html");

            // 1. Generate dynamic external images
            // Creates a professional avatar with the user's initials
            String formattedName = safe(inviterName).replace(" ", "+");
            String avatarUrl = "https://ui-avatars.com/api/?name=" + formattedName
                    + "&background=F3F4F6&color=374151&size=128";

            // Clean placeholder logo for Planora
            String logoUrl = "https://placehold.co/120x32/ffffff/2563eb?text=Planora&font=Montserrat";

            // Optional: A dynamic personal message
            String personalMessage = "Hi team, I've set up our workspace for the upcoming deliverables. Please join the project so we can start tracking our tasks and milestones together.";

            // 2. Replace placeholders in the HTML String
            html = html.replace("{{INVITER_NAME}}", safe(inviterName))
                    .replace("{{PROJECT_NAME}}", safe(projectName))
                    .replace("{{YEAR}}", String.valueOf(Year.now().getValue()))
                    .replace("{{LOGO_URL}}", logoUrl)
                    .replace("{{AVATAR_URL}}", avatarUrl)
                    .replace("{{PERSONAL_MESSAGE}}", personalMessage)
                    .replace("{{CTA_TEXT}}", "Accept Invitation")
                    .replace("{{CTA_URL}}", "http://localhost:3000/accept-invite?token=" + token) // Updated actual URL
                    .replace("{{PRIVACY_URL}}", "https://yourfrontend.com/privacy")
                    .replace("{{CONTACT_URL}}", "https://yourfrontend.com/contact");

            sendHtml(toEmail, "Planora - Project Invitation", html);

        } catch (Exception e) {
            throw new RuntimeException("Failed to send invitation email", e);
        }
    }

    private void sendHtml(String to, String subject, String html) throws MessagingException {
        MimeMessage mimeMessage = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, StandardCharsets.UTF_8.name());
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(html, true); // true = HTML
        helper.setFrom("no-reply@planora.com");

        mailSender.send(mimeMessage);
    }

    private String loadTemplate(String classpathPath) throws Exception {
        ClassPathResource resource = new ClassPathResource(classpathPath);
        byte[] bytes = resource.getInputStream().readAllBytes();
        return new String(bytes, StandardCharsets.UTF_8);
    }

    private String safe(String s) {
        return (s == null) ? "" : s;
    }
}