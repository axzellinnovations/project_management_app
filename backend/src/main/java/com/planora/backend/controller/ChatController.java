package com.planora.backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import java.util.Objects;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatMessage.ChatType;
import com.planora.backend.repository.ChatRoomMemberRepository;
import com.planora.backend.repository.ChatRoomRepository;
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

    @Autowired
    private ChatRoomRepository chatRoomRepository;

    @Autowired
    private ChatRoomMemberRepository chatRoomMemberRepository;

    // This method handles messages sent to "/app/project/{projectId}/chat.sendMessage".
    // The return value is broadcast to all subscribers of "/topic/project/{projectId}/public".
    @MessageMapping("/project/{projectId}/chat.sendMessage")
    @SendTo("/topic/project/{projectId}/public")
    public ChatMessage sendMessage(@DestinationVariable Long projectId,
                                   @Payload ChatMessage chatMessage,
                                   SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        validateProjectMembership(projectId, username);

        chatMessage.setSender(resolveCanonicalChatIdentifier(username));

        chatMessage.setProjectId(projectId);
        chatMessage.setChatType(ChatType.GROUP);

        ChatMessage saved = chatService.saveMessage(chatMessage);
        return saved;
    }
    @MessageMapping("/project/{projectId}/chat.sendPrivateMessage")
    public void sendPrivateMessage(@DestinationVariable Long projectId, @Payload ChatMessage chatMessage, SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        validateProjectMembership(projectId, username);

        var canonicalSender = resolveCanonicalChatIdentifier(username);
        var canonicalRecipient = resolveCanonicalChatIdentifier(chatMessage.getRecipient());
        chatMessage.setSender(canonicalSender);
        chatMessage.setRecipient(canonicalRecipient);

        // Validate recipient is also a member
        validateProjectMembership(projectId, chatMessage.getRecipient());
        System.out.println(
                "Private message received from: " + chatMessage.getSender() + " to: " + chatMessage.getRecipient());
        chatMessage.setProjectId(projectId);
        chatMessage.setChatType(ChatType.PRIVATE);
        // persist private message as well
        ChatMessage saved = chatService.saveMessage(chatMessage);
        sendPrivateMessageToRecipientAliases(projectId, Objects.requireNonNull(chatMessage.getRecipient()), Objects.requireNonNull(saved));
    }

    @MessageMapping("/project/{projectId}/room/{roomId}/send")
    @SendTo("/topic/project/{projectId}/room/{roomId}")
    public ChatMessage sendRoomMessage(@DestinationVariable Long projectId,
                                       @DestinationVariable Long roomId,
                                       @Payload ChatMessage chatMessage,
                                       SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        validateProjectMembership(projectId, username);
        validateRoomMembership(roomId, username);

        chatMessage.setSender(resolveCanonicalChatIdentifier(username));

        chatMessage.setProjectId(projectId);
        chatMessage.setRoomId(roomId);
        chatMessage.setChatType(ChatType.GROUP);

        ChatMessage saved = chatService.saveMessage(chatMessage);
        return saved;
    }

    private void validateRoomMembership(Long roomId, String usernameOrEmail) {
        var user = resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            throw new RuntimeException("User is not found");
        }
        if (chatRoomMemberRepository.findByChatRoomIdAndUserUserId(roomId, user.getUserId()).isPresent()) {
            return;
        }

        var room = chatRoomRepository.findById(roomId).orElseThrow(() -> new RuntimeException("Chat room not found"));
        if (isRoomCreator(room, user, usernameOrEmail)) {
            var roomMember = new com.planora.backend.model.ChatRoomMember();
            roomMember.setChatRoom(room);
            roomMember.setUser(user);
            chatRoomMemberRepository.save(roomMember);
            return;
        }

        throw new RuntimeException("User is not a member of this room");
    }

    // This method handles messages sent to "/app/project/{projectId}/chat.addUser".
    // It adds the username to the WebSocket session and broadcasts the join
    // message.
    @MessageMapping("/project/{projectId}/chat.addUser")
    @SendTo("/topic/project/{projectId}/public")
    public ChatMessage addUser(@DestinationVariable Long projectId, @Payload ChatMessage chatMessage,
                               SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        validateProjectMembership(projectId, username);
        chatMessage.setSender(resolveCanonicalChatIdentifier(username));
        chatMessage.setProjectId(projectId);
        chatMessage.setChatType(ChatType.GROUP);
        // Add username in web socket session so we can retrieve it on disconnect
        var sessionAttributes = headerAccessor.getSessionAttributes();
        if (sessionAttributes != null) {
            sessionAttributes.put("username", chatMessage.getSender());
        }
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

    private com.planora.backend.model.User resolveUserByEmailOrUsername(String usernameOrEmail) {
        if (usernameOrEmail == null || usernameOrEmail.isBlank()) {
            return null;
        }
        var normalized = usernameOrEmail.toLowerCase();
        var byEmail = userRepository.findByEmailIgnoreCase(normalized).orElse(null);
        if (byEmail != null) {
            return byEmail;
        }
        return userRepository.findByUsernameIgnoreCase(normalized).orElse(null);
    }

    private String resolveCanonicalChatIdentifier(String usernameOrEmail) {
        if (usernameOrEmail == null || usernameOrEmail.isBlank()) {
            return usernameOrEmail;
        }

        var user = resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            return usernameOrEmail.toLowerCase();
        }

        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername().toLowerCase();
        }

        return user.getEmail() != null ? user.getEmail().toLowerCase() : usernameOrEmail.toLowerCase();
    }

    private void sendPrivateMessageToRecipientAliases(Long projectId, String recipient, ChatMessage savedMessage) {
        var resolvedRecipient = resolveUserByEmailOrUsername(recipient);
        if (resolvedRecipient == null) {
            simpMessagingTemplate.convertAndSendToUser(
                    recipient.toLowerCase(),
                    "/queue/project/" + projectId + "/messages",
                    savedMessage);
            return;
        }

        var destination = "/queue/project/" + projectId + "/messages";
        var username = resolvedRecipient.getUsername() != null ? resolvedRecipient.getUsername().toLowerCase() : null;
        var email = resolvedRecipient.getEmail() != null ? resolvedRecipient.getEmail().toLowerCase() : null;

        if (username != null && !username.isBlank()) {
            simpMessagingTemplate.convertAndSendToUser(username, destination, savedMessage);
        }

        if (email != null && !email.isBlank() && (username == null || !email.equals(username))) {
            simpMessagingTemplate.convertAndSendToUser(email, destination, savedMessage);
        }
    }

    private String requireAuthenticatedUsername(SimpMessageHeaderAccessor headerAccessor) {
        var principal = headerAccessor.getUser();
        if (principal == null || principal.getName() == null) {
            throw new IllegalArgumentException("WebSocket user is not authenticated");
        }

        return principal.getName();
    }

    private boolean isRoomCreator(com.planora.backend.model.ChatRoom room, com.planora.backend.model.User user, String usernameOrEmail) {
        if (room.getCreatedBy() == null) {
            return false;
        }
        return room.getCreatedBy().equalsIgnoreCase(usernameOrEmail)
                || (user.getEmail() != null && room.getCreatedBy().equalsIgnoreCase(user.getEmail()))
                || (user.getUsername() != null && room.getCreatedBy().equalsIgnoreCase(user.getUsername()));
    }
}
