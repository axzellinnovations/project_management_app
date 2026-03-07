package com.planora.backend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

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

    public void sendVerificationEmail(String toEmail, String otp){
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

    public void sendPasswordResetRequest(String toEmail, String otp){
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
}
