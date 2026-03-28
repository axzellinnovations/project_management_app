package com.planora.backend.configuration;


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
                    System.err.println("[WebSocket] No StompHeaderAccessor found");
                    return message;
                }

                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    try {
                        // Read JWT token from Authorization header (Bearer token)
                        String auth = accessor.getFirstNativeHeader("Authorization");
                        
                        System.out.println("[WebSocket] CONNECT received with Authorization header: " + (auth != null ? "Present" : "Missing"));

                        if (auth == null || auth.trim().isEmpty()) {
                            System.err.println("[WebSocket] Missing Authorization header");
                            throw new IllegalArgumentException("Missing Authorization header");
                        }

                        // Remove "Bearer " prefix if present
                        String token = auth.startsWith("Bearer ") ?
                                auth.substring("Bearer ".length()).trim() :
                                auth.trim();

                        System.out.println("[WebSocket] Token received, extracting username...");
                        
                        // Extract username from token
                        String email = jwtService.extractUserName(token);
                        System.out.println("[WebSocket] Extracted email from token: " + email);

                        // Find user by email
                        User user = userRepository.findByEmail(email);
                        
                        if (user == null) {
                            System.err.println("[WebSocket] User not found in database for email: " + email);
                            throw new IllegalArgumentException("User not found in database");
                        }

                        String username = user.getUsername();
                        
                        if (username == null || username.trim().isEmpty()) {
                            System.err.println("[WebSocket] Invalid username in token for user: " + email);
                            throw new IllegalArgumentException("Invalid username in token");
                        }

                        String normalizedUsername = username.toLowerCase();

                        System.out.println("[WebSocket] Setting user principal: " + normalizedUsername);
                        accessor.setUser(new StompPrincipal(normalizedUsername));
                        accessor.getSessionAttributes().put("username", normalizedUsername);
                        
                        System.out.println("[WebSocket] Authentication successful for user: " + normalizedUsername);
                    } catch (Exception e) {
                        System.err.println("[WebSocket] Authentication error: " + e.getMessage());
                        e.printStackTrace();
                        throw new IllegalArgumentException("WebSocket authentication failed: " + e.getMessage());
                    }
                }

                return message;
            }
        });
    }
}