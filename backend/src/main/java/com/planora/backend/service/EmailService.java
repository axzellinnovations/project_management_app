package com.planora.backend.service;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSenderImpl mailSender;

    public EmailService(JavaMailSenderImpl mailSender) {
        this.mailSender = mailSender;
    }

    public void sendVerificationEmail(String toEmail, String otp){
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("no-reply@planora.com");
        message.setTo(toEmail);
        message.setSubject("Planora - Your Verification Code");
        message.setText("Your verification code is: "
                + otp +
                "\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.");
        mailSender.send(message);

    }

    public void sendPasswordResetRequest(String toEmail, String otp){
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom("no-reply@planora.com");
        message.setTo(toEmail);
        message.setSubject("Planora - Password Reset Code");
        message.setText("Your code to reset your password is: " + otp +
                "\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.");
        mailSender.send(message);
    }
}
