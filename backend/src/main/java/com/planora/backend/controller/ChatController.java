package com.planora.backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatMessage.ChatType;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.ChatService;

@Controller
public class ChatController {

    @Autowired
    private SimpMessagingTemplate simpMessagingTemplate;

    @Autowired
    private ChatService chatService;

    @Autowired
    private TeamMemberRepository teamMemberRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserRepository userRepository;

    // This method handles messages sent to "/app/project/{projectId}/chat.sendMessage".
    // The return value is broadcast to all subscribers of "/topic/project/{projectId}/public".
    @MessageMapping("/project/{projectId}/chat.sendMessage")
    @SendTo("/topic/project/{projectId}/public")
    public ChatMessage sendMessage(@DestinationVariable Long projectId,
                                   @Payload ChatMessage chatMessage,
                                   SimpMessageHeaderAccessor headerAccessor) {

        if (headerAccessor.getUser() == null) {
            throw new IllegalArgumentException("WebSocket user is not authenticated");
        }

        String username = headerAccessor.getUser().getName();
        validateProjectMembership(projectId, username);

        if (chatMessage.getSender() != null) {
            chatMessage.setSender(chatMessage.getSender().toLowerCase());
        }

        chatMessage.setProjectId(projectId);
        chatMessage.setChatType(ChatType.GROUP);

        ChatMessage saved = chatService.saveMessage(chatMessage);
        return saved;
    }
    @MessageMapping("/project/{projectId}/chat.sendPrivateMessage")
    public void sendPrivateMessage(@DestinationVariable Long projectId, @Payload ChatMessage chatMessage, SimpMessageHeaderAccessor headerAccessor) {
        String username = headerAccessor.getUser().getName();
        validateProjectMembership(projectId, username);
        if (chatMessage.getSender() != null) {
            chatMessage.setSender(chatMessage.getSender().toLowerCase());
        }
        if (chatMessage.getRecipient() != null) {
            chatMessage.setRecipient(chatMessage.getRecipient().toLowerCase());
        }
        // Validate recipient is also a member
        validateProjectMembership(projectId, chatMessage.getRecipient());
        System.out.println(
                "Private message received from: " + chatMessage.getSender() + " to: " + chatMessage.getRecipient());
        chatMessage.setProjectId(projectId);
        chatMessage.setChatType(ChatType.PRIVATE);
        // persist private message as well
        ChatMessage saved = chatService.saveMessage(chatMessage);
        simpMessagingTemplate.convertAndSendToUser(
                chatMessage.getRecipient(),
                "/queue/project/" + projectId + "/messages", // resulting in /user/{recipient}/queue/project/{projectId}/messages
                saved);
    }

    // This method handles messages sent to "/app/project/{projectId}/chat.addUser".
    // It adds the username to the WebSocket session and broadcasts the join
    // message.
    @MessageMapping("/project/{projectId}/chat.addUser")
    @SendTo("/topic/project/{projectId}/public")
    public ChatMessage addUser(@DestinationVariable Long projectId, @Payload ChatMessage chatMessage,
                               SimpMessageHeaderAccessor headerAccessor) {
        String username = headerAccessor.getUser().getName();
        validateProjectMembership(projectId, username);
        if (chatMessage.getSender() != null) {
            chatMessage.setSender(chatMessage.getSender().toLowerCase());
        }
        chatMessage.setProjectId(projectId);
        chatMessage.setChatType(ChatType.GROUP);
        // Add username in web socket session so we can retrieve it on disconnect
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        // optionally save join notification and broadcast the managed entity
        ChatMessage saved = chatService.saveMessage(chatMessage);
        return saved;
    }

    private void validateProjectMembership(Long projectId, String usernameOrEmail) {
        // Try to find by email first (JWT principal name is typically email)
        var user = userRepository.findByEmail(usernameOrEmail.toLowerCase());
        
        // If not found by email and it looks like it might be a username, search through all users
        // and match by username
        if (user == null) {
            // Since UserRepository doesn't have findByUsername, we'll trust the authentication
            // and just validate project membership by fetching the project and checking if
            // the authenticated user's email/username exists in team members
            var project = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Project not found"));
            var teamMembers = teamMemberRepository.findByTeamId(project.getTeam().getId());
            boolean isMember = teamMembers.stream().anyMatch(tm -> 
                tm.getUser().getEmail().equalsIgnoreCase(usernameOrEmail) || 
                (tm.getUser().getUsername() != null && tm.getUser().getUsername().equalsIgnoreCase(usernameOrEmail))
            );
            if (!isMember) {
                throw new RuntimeException("User is not a member of the project");
            }
            return;
        }
        
        var project = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Project not found"));
        boolean isMember = teamMemberRepository.findByTeamIdAndUserUserId(project.getTeam().getId(), user.getUserId()).isPresent();
        if (!isMember) {
            throw new RuntimeException("User is not a member of the project");
        }
    }
}
