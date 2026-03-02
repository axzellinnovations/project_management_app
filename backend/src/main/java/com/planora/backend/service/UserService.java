package com.planora.backend.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Random;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import com.planora.backend.dto.LoginResponse;
import com.planora.backend.model.User;
import com.planora.backend.model.VerificationToken;
import com.planora.backend.repository.TokenRepository;
import com.planora.backend.repository.UserRepository;

import jakarta.transaction.Transactional;

@Service
public class UserService {

    private final UserRepository repository;

    private final JWTService jwtService;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
    private final TokenRepository tokenRepository;
    private final EmailService emailService;
    private final UserRepository userRepository;

    private AuthenticationManager authenticationManager;

    public UserService(UserRepository repository, JWTService jwtService, AuthenticationManager authenticationManager, TokenRepository tokenRepository, EmailService emailService, UserRepository userRepository){
        this.repository = repository;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.tokenRepository = tokenRepository;
        this.emailService = emailService;
        this.userRepository = userRepository;
    }

    @Transactional
    public String register(User user) {

        User existingUser = userRepository.findByEmail(user.getEmail().toLowerCase());

        if(existingUser!=null){
            if(!existingUser.isVerified()){
                tokenRepository.deleteByUser(existingUser);
                tokenRepository.flush();
                user=existingUser;
            }
            else {
                return "User already verified. Please login.";
            }
        }
        else {
            //save unverified user
            user.setEmail(user.getEmail().toLowerCase());
            user.setPassword(encoder.encode(user.getPassword()));
            user.setVerified(false);
            repository.save(user);
            repository.flush();
        }

        String otp = String.valueOf(new Random().nextInt(900000) + 100000);
        VerificationToken verificationToken = new VerificationToken();
        verificationToken.setUser(user);
        verificationToken.setToken(otp);
        verificationToken.setTokenType(VerificationToken.TokenType.VERIFICATION);
        verificationToken.setExpiry(Instant.now().plus(java.time.Duration.ofMinutes(10)));
        tokenRepository.save(verificationToken);

        emailService.sendVerificationEmail(user.getEmail(), otp);
        return "OTP send successfully";
    }

    @Transactional
    public boolean verifyToken(String email, String otp){
        User user = userRepository.findByEmail(email.toLowerCase());
        VerificationToken verificationToken = tokenRepository.findByUser(user);

        if(verificationToken == null || verificationToken.isUsed() || verificationToken.getExpiry().isBefore(Instant.now())){
            return false;
        }

        if(verificationToken.getAttempts() >= 5){
            return false;
        }

        if(verificationToken.getToken().equals(otp)){
            user.setVerified(true);
            verificationToken.setUsed(true);
            userRepository.save(user);
            tokenRepository.save(verificationToken);
            return true;
        }
        else {
            verificationToken.setAttempts(verificationToken.getAttempts() + 1);
            tokenRepository.save(verificationToken);
            return false;
        }
    }

    public String verify(User user) {
        Authentication authentication =
                authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
                        user.getEmail().toLowerCase(),
                        user.getPassword()));

        if(authentication.isAuthenticated()){
            User authenticatedUser = userRepository.findByEmail(user.getEmail().toLowerCase());
            return jwtService.generateToken(user.getEmail(), authenticatedUser.getUsername());
        }

        return "Failed to login";
    }

    @Transactional
    public LoginResponse loginUser(User user) {
        try {
            Authentication authentication =
                    authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
                            user.getEmail().toLowerCase(),
                            user.getPassword()));

            if(authentication.isAuthenticated()){
                User authenticatedUser = userRepository.findByEmail(user.getEmail().toLowerCase());
                String token = jwtService.generateToken(user.getEmail(), authenticatedUser.getUsername());
                LoginResponse response = new LoginResponse();
                response.setSuccess(true);
                response.setMessage("Login successful");
                response.setToken(token);
                return response;
            }

            LoginResponse response = new LoginResponse();
            response.setSuccess(false);
            response.setMessage("Incorrect username or password");
            response.setErrorCode("INVALID_CREDENTIALS");
            return response;
        } catch (DisabledException e) {
            LoginResponse response = new LoginResponse();
            response.setSuccess(false);
            response.setMessage("Email is not verified. Please check your email.");
            response.setErrorCode("UNVERIFIED_EMAIL");
            return response;
        } catch (BadCredentialsException e) {
            LoginResponse response = new LoginResponse();
            response.setSuccess(false);
            response.setMessage("Incorrect username or password");
            response.setErrorCode("INVALID_CREDENTIALS");
            return response;
        } catch (AuthenticationException e) {
            LoginResponse response = new LoginResponse();
            response.setSuccess(false);
            response.setMessage("Incorrect username or password");
            response.setErrorCode("INVALID_CREDENTIALS");
            return response;
        }
    }

    @Transactional
    public String resendOtp(String email) {
        User user = userRepository.findByEmail(email.toLowerCase());

        if(user == null){
            return "User is not found";
        }

        if(user.isVerified()){
            return "User already verified.";
        }

        tokenRepository.deleteByUser(user);
        tokenRepository.flush();

        String otp = String.valueOf(new Random().nextInt(900000) + 100000);
        VerificationToken verificationToken = new VerificationToken();
        verificationToken.setUser(user);
        verificationToken.setToken(otp);
        verificationToken.setTokenType(VerificationToken.TokenType.VERIFICATION);
        verificationToken.setExpiry(Instant.now().plus(java.time.Duration.ofMinutes(10)));
        tokenRepository.save(verificationToken);

        emailService.sendVerificationEmail(email.toLowerCase(), otp);
        return "New OTP send to your email.";
    }

    private String generateSecureToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    @Transactional
    public String forgotPassword(String email) {
        User user = userRepository.findByEmail(email.toLowerCase());

        if(user == null)
            return "If that email exists, an OTP has been sent.";

        // Delete existing password reset tokens for this user
        VerificationToken existingToken = tokenRepository.findByUserAndTokenType(user, VerificationToken.TokenType.PASSWORD_RESET);
        if (existingToken != null) {
            tokenRepository.delete(existingToken);
        }
        tokenRepository.flush();

        String otp = String.valueOf(new Random().nextInt(900000) + 100000);
        VerificationToken verificationToken = new VerificationToken();
        verificationToken.setUser(user);
        verificationToken.setToken(otp);
        verificationToken.setTokenType(VerificationToken.TokenType.PASSWORD_RESET);
        verificationToken.setExpiry(Instant.now().plus(java.time.Duration.ofMinutes(10)));
        tokenRepository.save(verificationToken);

        emailService.sendPasswordResetRequest(email.toLowerCase(), otp);
        return "Password reset OTP sent successfully.";
    }

    @Transactional
    public boolean resetPassword(String token, String newPassword) {
        VerificationToken verificationToken = tokenRepository.findByToken(token);

        if(verificationToken == null || verificationToken.isUsed() || verificationToken.isExpired() 
            || verificationToken.getTokenType() != VerificationToken.TokenType.PASSWORD_RESET){
            return false;
        }

        User user = verificationToken.getUser();
        user.setPassword(encoder.encode(newPassword));
        verificationToken.setUsed(true);
        userRepository.save(user);
        tokenRepository.save(verificationToken);
        return true;
    }

    // Deprecated: Use resetPassword(token, newPassword) instead
    @Transactional
    @Deprecated
    public boolean resetPassword(String email, String otp, String newPassword) {
        User user = userRepository.findByEmail(email.toLowerCase());
        VerificationToken verificationToken = tokenRepository.findByUser(user);

        if(verificationToken != null && verificationToken.getToken().equals(otp) && !verificationToken.isExpired() 
            && verificationToken.getTokenType() == VerificationToken.TokenType.PASSWORD_RESET){
            user.setPassword(encoder.encode(newPassword));
            verificationToken.setUsed(true);
            userRepository.save(user);
            tokenRepository.save(verificationToken);
            return true;
        }

        return false;
    }

    public java.util.List<User> getAllUsers() {
        return userRepository.findAll();
    }
}

