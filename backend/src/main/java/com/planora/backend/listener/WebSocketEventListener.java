package com.planora.backend.listener;

import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.planora.backend.controller.ChatController;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.ChatPresenceService;

@Component
public class WebSocketEventListener {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketEventListener.class);

    // This template is used to send messages to WebSocket destinations
    @Autowired
    private SimpMessageSendingOperations messagingTemplate;

    @Autowired
    private ChatPresenceService chatPresenceService;

    @Autowired
    private UserRepository userRepository;

    // This method is called whenever a WebSocket connection is disconnected
    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        // Wrap the event message to access STOMP headers
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());

        // Retrieve the username from the session attributes (we added it in
        // ChatController.addUser)
        var sessionAttributes = headerAccessor.getSessionAttributes();
        if (sessionAttributes == null) {
            return;
        }

        String username = (String) sessionAttributes.get("username");
        String sessionId = headerAccessor.getSessionId();

        if (username != null) {
            logger.info("User Disconnected : " + username);
            userRepository.findByUsernameIgnoreCase(username).ifPresent(user -> {
                user.setLastActive(LocalDateTime.now());
                userRepository.save(user);
            });
            var presenceUpdates = chatPresenceService.markOfflineForSession(sessionId, username);
            presenceUpdates.forEach((projectId, onlineUsers) ->
                    messagingTemplate.convertAndSend(
                            "/topic/project/" + projectId + "/presence",
                            new ChatController.PresenceEvent("OFFLINE", username, onlineUsers)));
        }
    }
}
