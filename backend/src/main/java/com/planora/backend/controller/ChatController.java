package com.planora.backend.controller;

import java.util.List;
import java.util.Objects;

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
import com.planora.backend.repository.ChatRoomMemberRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.ChatService;

@Controller
public class ChatController {

    public static record EditMessagePayload(String content, ChatMessage.FormatType formatType) {}

    public static record ReactionTogglePayload(String emoji) {}

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
        sendPrivateMessageToConversationParticipants(projectId, Objects.requireNonNull(saved));
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

        var room = chatRoomRepository.findById(roomId).orElseThrow(() -> new RuntimeException("Chat room not found"));
        if (Boolean.TRUE.equals(room.getArchived())) {
            throw new RuntimeException("Channel is archived and read-only");
        }

        chatMessage.setSender(resolveCanonicalChatIdentifier(username));

        chatMessage.setProjectId(projectId);
        chatMessage.setRoomId(roomId);
        chatMessage.setChatType(ChatType.GROUP);

        ChatMessage saved = chatService.saveMessage(chatMessage);
        return saved;
    }

    @MessageMapping("/project/{projectId}/thread/{rootMessageId}/send")
    @SendTo("/topic/project/{projectId}/thread/{rootMessageId}")
    public ChatMessage sendThreadReply(@DestinationVariable Long projectId,
                                       @DestinationVariable Long rootMessageId,
                                       @Payload ChatMessage chatMessage,
                                       SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        validateProjectMembership(projectId, username);

        chatMessage.setSender(resolveCanonicalChatIdentifier(username));
        chatMessage.setType(ChatMessage.MessageType.CHAT);
        if (chatMessage.getFormatType() == null) {
            chatMessage.setFormatType(ChatMessage.FormatType.PLAIN);
        }

        return chatService.saveThreadReply(projectId, rootMessageId, chatMessage);
    }

    @MessageMapping("/project/{projectId}/messages/{messageId}/edit")
    public void editMessage(@DestinationVariable Long projectId,
                            @DestinationVariable Long messageId,
                            @Payload EditMessagePayload payload,
                            SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        validateProjectMembership(projectId, username);

        var updated = chatService.editMessage(
                projectId,
                messageId,
                username,
                payload.content(),
                payload.formatType());

        publishMessageEvent(projectId, updated);
    }

    @MessageMapping("/project/{projectId}/messages/{messageId}/delete")
    public void deleteMessage(@DestinationVariable Long projectId,
                              @DestinationVariable Long messageId,
                              SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        validateProjectMembership(projectId, username);

        var deleted = chatService.softDeleteMessage(projectId, messageId, username);
        publishMessageEvent(projectId, deleted);
    }

    @SuppressWarnings("null")
    @MessageMapping("/project/{projectId}/messages/{messageId}/reaction.toggle")
    public void toggleReaction(@DestinationVariable Long projectId,
                               @DestinationVariable Long messageId,
                               @Payload ReactionTogglePayload payload,
                               SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        validateProjectMembership(projectId, username);

        var reactions = chatService.toggleReaction(projectId, messageId, username, payload.emoji());

        simpMessagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/messages/" + messageId + "/reactions",
            Objects.requireNonNull(reactions));
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
        // Presence JOIN is ephemeral; do not persist it in chat_message.
        if (chatMessage.getType() == null) {
            chatMessage.setType(ChatMessage.MessageType.JOIN);
        }
        return chatMessage;
    }

    private void validateProjectMembership(Long projectId, String usernameOrEmail) {
        var user = resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            throw new RuntimeException("User is not found");
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
        if (normalized.contains("@")) {
            var byEmail = userRepository.findByEmailIgnoreCase(normalized).orElse(null);
            if (byEmail != null) {
                return byEmail;
            }
            return userRepository.findByUsernameIgnoreCase(normalized).orElse(null);
        }

        var byUsername = userRepository.findByUsernameIgnoreCase(normalized).orElse(null);
        if (byUsername != null) {
            return byUsername;
        }

        return userRepository.findByEmailIgnoreCase(normalized).orElse(null);
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

    private void publishMessageEvent(Long projectId, ChatMessage message) {
        if (message.getRecipient() != null && !message.getRecipient().isBlank()) {
            sendPrivateMessageToConversationParticipants(projectId, message);
            return;
        }

        var threadRootId = chatService.resolveThreadTopicRootId(projectId, message).orElse(null);
        if (threadRootId != null) {
            simpMessagingTemplate.convertAndSend(
                    "/topic/project/" + projectId + "/thread/" + threadRootId,
                    message);
        }

        if (message.getRoomId() != null) {
            simpMessagingTemplate.convertAndSend(
                    "/topic/project/" + projectId + "/room/" + message.getRoomId(),
                    message);
            return;
        }

        simpMessagingTemplate.convertAndSend("/topic/project/" + projectId + "/public", message);
    }

    private void sendPrivateMessageToConversationParticipants(Long projectId, ChatMessage savedMessage) {
        var destination = "/queue/project/" + projectId + "/messages";
        var aliases = List.of(
                savedMessage.getSender(),
                savedMessage.getRecipient());

        aliases.stream()
                .filter(alias -> alias != null && !alias.isBlank())
                .map(this::resolveUserByEmailOrUsername)
                .filter(Objects::nonNull)
                .forEach(user -> {
                    if (user.getUsername() != null && !user.getUsername().isBlank()) {
                        simpMessagingTemplate.convertAndSendToUser(user.getUsername().toLowerCase(), destination, savedMessage);
                    }

                    if (user.getEmail() != null && !user.getEmail().isBlank()) {
                        simpMessagingTemplate.convertAndSendToUser(user.getEmail().toLowerCase(), destination, savedMessage);
                    }
                });
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
