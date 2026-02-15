package com.planora.backend.controller;

import com.planora.backend.model.ChatMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class ChatController {

    @Autowired
    private SimpMessagingTemplate simpMessagingTemplate;

    // This method handles messages sent to "/app/chat.sendMessage".
    // The return value is broadcast to all subscribers of "/topic/public".
    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage) {
        if (chatMessage.getSender() != null) {
            chatMessage.setSender(chatMessage.getSender().toLowerCase());
        }
        return chatMessage;
    }

    @MessageMapping("/chat.sendPrivateMessage")
    public void sendPrivateMessage(@Payload ChatMessage chatMessage) {
        if (chatMessage.getSender() != null) {
            chatMessage.setSender(chatMessage.getSender().toLowerCase());
        }
        if (chatMessage.getRecipient() != null) {
            chatMessage.setRecipient(chatMessage.getRecipient().toLowerCase());
        }
        System.out.println(
                "Private message received from: " + chatMessage.getSender() + " to: " + chatMessage.getRecipient());
        // Send to specific user. Destination will be /user/{username}/queue/messages
        simpMessagingTemplate.convertAndSendToUser(
                chatMessage.getRecipient(),
                "/queue/messages", // resulting in /user/{recipient}/queue/messages
                chatMessage);
    }

    // This method handles messages sent to "/app/chat.addUser".
    // It adds the username to the WebSocket session and broadcasts the join
    // message.
    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Payload ChatMessage chatMessage,
                               SimpMessageHeaderAccessor headerAccessor) {
        if (chatMessage.getSender() != null) {
            chatMessage.setSender(chatMessage.getSender().toLowerCase());
        }
        // Add username in web socket session so we can retrieve it on disconnect
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        return chatMessage;
    }
}
