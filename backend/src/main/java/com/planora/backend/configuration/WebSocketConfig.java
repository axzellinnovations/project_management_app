package com.planora.backend.configuration;


import com.planora.backend.service.JWTService;
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

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JWTService jwtService;

    public WebSocketConfig(JWTService jwtService) {
        this.jwtService = jwtService;
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

                if (accessor == null) return message;

                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    // Read JWT token from Authorization header (Bearer token)
                    String auth = accessor.getFirstNativeHeader("Authorization");

                    if (auth == null || auth.trim().isEmpty()) {
                        throw new IllegalArgumentException("Missing Authorization header");
                    }

                    // Remove "Bearer " prefix if present
                    String token = auth.startsWith("Bearer ") ?
                            auth.substring("Bearer ".length()).trim() :
                            auth.trim();

                    // Extract username from token and set as principal
                    String username = jwtService.extractUsername(token);
                    if (username == null || username.trim().isEmpty()) {
                        throw new IllegalArgumentException("Invalid username in token");
                    }

                    accessor.setUser(new StompPrincipal(username));

                    // Store username in session for disconnect event
                    accessor.getSessionAttributes().put("username", username);
                }

                return message;
            }
        });
    }
}