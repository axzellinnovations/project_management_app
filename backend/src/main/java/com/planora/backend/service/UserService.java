package com.planora.backend.service;

import com.planora.backend.model.User;
import com.planora.backend.model.VerificationToken;
import com.planora.backend.repository.TokenRepository;
import com.planora.backend.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Random;

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

        User existingUser = userRepository.findByEmail(user.getEmail());

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
            user.setPassword(encoder.encode(user.getPassword()));
            user.setVerified(false);
            repository.save(user);
            repository.flush();
        }

        String otp = String.valueOf(new Random().nextInt(900000) + 100000);
        VerificationToken verificationToken = new VerificationToken();
        verificationToken.setUser(user);
        verificationToken.setToken(otp);
        verificationToken.setExpiry(Instant.now().plus(java.time.Duration.ofMinutes(10)));
        tokenRepository.save(verificationToken);

        emailService.sendVerificationEmail(user.getEmail(), otp);
        return "OTP send successfully";
    }

    @Transactional
    public boolean verifyToken(String email, String otp){
        User user = userRepository.findByEmail(email);
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
                        user.getEmail(),
                        user.getPassword()));

        if(authentication.isAuthenticated()){
            return jwtService.generateToken(user.getEmail());
        }

        return "Failed to login";

    }

}
