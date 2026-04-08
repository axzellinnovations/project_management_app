package com.planora.backend.configuration;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import com.planora.backend.model.User;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.JWTService;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WebSocketConfig.class);

    private final JWTService jwtService;
    private final UserRepository userRepository;

    public WebSocketConfig(JWTService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (accessor == null) {
                    log.error("[WebSocket] No StompHeaderAccessor found");
                    return message;
                }

                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    try {
                        // Read JWT token from Authorization header (Bearer token)
                        String auth = accessor.getFirstNativeHeader("Authorization");
                        
                        log.info("[WebSocket] CONNECT received with Authorization header: {}", auth != null ? "Present" : "Missing");

                        if (auth == null || auth.trim().isEmpty()) {
                            log.error("[WebSocket] Missing Authorization header");
                            throw new IllegalArgumentException("Missing Authorization header");
                        }

                        // Remove "Bearer " prefix if present
                        String token = auth.startsWith("Bearer ") ?
                                auth.substring("Bearer ".length()).trim() :
                                auth.trim();

                        log.info("[WebSocket] Token received, extracting username...");
                        
                        // Extract username from token
                        String email = jwtService.extractUserName(token);
                        log.info("[WebSocket] Extracted email from token: {}", email);

                        // Find user by email
                        User user = userRepository.findByEmail(email);
                        
                        if (user == null) {
                            log.error("[WebSocket] User not found in database for email: {}", email);
                            throw new IllegalArgumentException("User not found in database");
                        }

                        String username = user.getUsername();
                        
                        if (username == null || username.trim().isEmpty()) {
                            log.error("[WebSocket] Invalid username in token for user: {}", email);
                            throw new IllegalArgumentException("Invalid username in token");
                        }

                        String normalizedUsername = username.toLowerCase();

                        log.info("[WebSocket] Setting user principal: {}", normalizedUsername);
                        accessor.setUser(new StompPrincipal(normalizedUsername));
                        accessor.getSessionAttributes().put("username", normalizedUsername);
                        
                        log.info("[WebSocket] Authentication successful for user: {}", normalizedUsername);
                    } catch (io.jsonwebtoken.ExpiredJwtException e) {
                        log.error("[WebSocket] Authentication failed: JWT expired");
                        throw new IllegalArgumentException("JWT expired");
                    } catch (io.jsonwebtoken.JwtException | IllegalArgumentException e) {
                        log.error("[WebSocket] Authentication failed: {}", e.getMessage());
                        throw new IllegalArgumentException("JWT invalid: " + e.getMessage());
                    } catch (Exception e) {
                        log.error("[WebSocket] Unexpected authentication error: {}", e.getMessage(), e);
                        throw new IllegalArgumentException("WebSocket authentication failed: " + e.getMessage());
                    }
                }

                return message;
            }
        });
    }
}