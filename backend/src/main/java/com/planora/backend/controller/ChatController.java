package com.planora.backend.controller;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

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
import com.planora.backend.service.ChatPresenceService;
import com.planora.backend.service.ChatService;
import com.planora.backend.service.ChatWebhookService;
import com.planora.backend.service.NotificationService;

@Controller
public class ChatController {

    private static final Pattern MENTION_PATTERN = Pattern.compile("(?<!\\S)@([A-Za-z0-9._-]+)");

    public static record EditMessagePayload(String content, ChatMessage.FormatType formatType) {}

    public static record ReactionTogglePayload(String emoji) {}

    public static record TypingPayload(String scope, Long roomId, String recipient, Boolean isTyping) {}

    public static record TypingEvent(String sender, String scope, Long roomId, String recipient, boolean typing) {}

    public static record PresenceEvent(String type, String user, List<String> onlineUsers) {}

    public static record MentionEvent(String type,
                                      Long projectId,
                                      Long messageId,
                                      String sender,
                                      String scope,
                                      Long roomId,
                                      String preview) {}

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

    @Autowired
    private ChatPresenceService chatPresenceService;

    @Autowired
    private ChatWebhookService chatWebhookService;

    // ── Added for persistent chat notifications ───────────────────────────────
    // Injects NotificationService so that DMs and @mentions create bell
    // notifications visible in the TopBar, not just transient WebSocket events.
    @Autowired
    private NotificationService notificationService;
    // ─────────────────────────────────────────────────────────────────────────

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
        publishMentionNotifications(projectId, saved, "TEAM");
        chatWebhookService.dispatchMessageEvent(projectId, "MESSAGE_CREATED", "TEAM", saved);
        publishUnreadBadgesForProject(projectId);
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
        publishMentionNotifications(projectId, saved, "PRIVATE");
        chatWebhookService.dispatchMessageEvent(projectId, "MESSAGE_CREATED", "PRIVATE", saved);
        publishUnreadBadgesForProject(projectId);

        // ── NOTIFICATION: persistent bell alert for the DM recipient ──────────
        // This ensures the recipient sees a badge in the TopBar even if they are
        // not currently on the chat page.  We resolve the recipient entity from
        // the canonical username and skip if sender == recipient.
        var senderUser = resolveUserByEmailOrUsername(canonicalSender);
        var recipientUser = resolveUserByEmailOrUsername(canonicalRecipient);
        if (recipientUser != null && senderUser != null
                && !recipientUser.getUserId().equals(senderUser.getUserId())) {
            // Use the sender's display name in the message text.
            String senderDisplay = (senderUser.getFullName() != null && !senderUser.getFullName().isBlank())
                    ? senderUser.getFullName() : senderUser.getUsername();
            String project = projectRepository.findById(projectId)
                    .map(p -> p.getName()).orElse("the project");
            String notifMessage = senderDisplay + " sent you a message in \"" + project + "\"";
            String notifLink = "/project/" + projectId + "/chat";
            // createNotificationIfNotDuplicate prevents a flood if the same user
            // rapidly sends multiple messages before the recipient opens the chat.
            notificationService.createNotificationIfNotDuplicate(recipientUser, notifMessage, notifLink);
        }
        // ─────────────────────────────────────────────────────────────────────
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
        publishMentionNotifications(projectId, saved, "ROOM");
        chatWebhookService.dispatchMessageEvent(projectId, "MESSAGE_CREATED", "ROOM", saved);
        publishUnreadBadgesForProject(projectId);
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

        var saved = chatService.saveThreadReply(projectId, rootMessageId, chatMessage);
        publishMentionNotifications(projectId, saved, "THREAD");
        chatWebhookService.dispatchMessageEvent(projectId, "MESSAGE_CREATED", "THREAD", saved);
        return saved;
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
            sessionAttributes.put("projectId", projectId);
        }

        var onlineUsers = chatPresenceService.markOnline(projectId, chatMessage.getSender(), headerAccessor.getSessionId());
        simpMessagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/presence",
                new PresenceEvent("ONLINE", chatMessage.getSender(), onlineUsers));

        // Presence JOIN is ephemeral; do not persist it in chat_message.
        if (chatMessage.getType() == null) {
            chatMessage.setType(ChatMessage.MessageType.JOIN);
        }
        return chatMessage;
    }

    @MessageMapping("/project/{projectId}/presence.ping")
    public void pingPresence(@DestinationVariable Long projectId,
                             SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        validateProjectMembership(projectId, username);

        var onlineUsers = chatPresenceService.markOnline(projectId, resolveCanonicalChatIdentifier(username), headerAccessor.getSessionId());
        simpMessagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/presence",
                new PresenceEvent("PING", resolveCanonicalChatIdentifier(username), onlineUsers));
    }

    @MessageMapping("/project/{projectId}/typing")
    public void typingEvent(@DestinationVariable Long projectId,
                            @Payload TypingPayload payload,
                            SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        validateProjectMembership(projectId, username);

        var canonicalSender = resolveCanonicalChatIdentifier(username);
        var scope = payload.scope() != null ? payload.scope().trim().toUpperCase() : "TEAM";
        var typing = payload.isTyping() != null && payload.isTyping();

        if ("ROOM".equals(scope)) {
            if (payload.roomId() == null) {
                return;
            }
            validateRoomMembership(payload.roomId(), username);
            simpMessagingTemplate.convertAndSend(
                    "/topic/project/" + projectId + "/typing/room/" + payload.roomId(),
                    new TypingEvent(canonicalSender, "ROOM", payload.roomId(), null, typing));
            return;
        }

        if ("PRIVATE".equals(scope)) {
            if (payload.recipient() == null || payload.recipient().isBlank()) {
                return;
            }
            validateProjectMembership(projectId, payload.recipient());
            var canonicalRecipient = resolveCanonicalChatIdentifier(payload.recipient());
            var event = new TypingEvent(canonicalSender, "PRIVATE", null, canonicalRecipient, typing);
            sendPrivateTypingEventToConversationParticipants(projectId, canonicalSender, canonicalRecipient, event);
            return;
        }

        simpMessagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/typing/team",
                new TypingEvent(canonicalSender, "TEAM", null, null, typing));
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

    private void publishMessageEvent(Long projectId, ChatMessage message) {
        var eventType = Boolean.TRUE.equals(message.getDeleted()) ? "MESSAGE_DELETED" : "MESSAGE_UPDATED";

        if (message.getRecipient() != null && !message.getRecipient().isBlank()) {
            sendPrivateMessageToConversationParticipants(projectId, message);
            chatWebhookService.dispatchMessageEvent(projectId, eventType, "PRIVATE", message);
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
            chatWebhookService.dispatchMessageEvent(projectId, eventType, "ROOM", message);
            return;
        }

        simpMessagingTemplate.convertAndSend("/topic/project/" + projectId + "/public", message);
        chatWebhookService.dispatchMessageEvent(projectId, eventType, "TEAM", message);
        publishUnreadBadgesForProject(projectId);
    }

    private void publishUnreadBadgesForProject(Long projectId) {
        var project = projectRepository.findById(projectId).orElse(null);
        if (project == null || project.getTeam() == null) {
            return;
        }

        var participants = teamMemberRepository.findByTeamId(project.getTeam().getId()).stream()
                .map(tm -> tm.getUser().getUsername())
                .filter(Objects::nonNull)
                .toList();

        participants.forEach(participant -> {
            var visibleRooms = getVisibleRooms(projectId, participant, false);
            var badge = chatService.buildUnreadBadge(projectId, participant, visibleRooms, participants);
            simpMessagingTemplate.convertAndSendToUser(
                    participant.toLowerCase(),
                    "/queue/project/" + projectId + "/unread-badge",
                    badge);

            var user = resolveUserByEmailOrUsername(participant);
            if (user != null && user.getEmail() != null && !user.getEmail().isBlank()) {
                simpMessagingTemplate.convertAndSendToUser(
                        user.getEmail().toLowerCase(),
                        "/queue/project/" + projectId + "/unread-badge",
                        badge);
            }
        });
    }

    private List<com.planora.backend.model.ChatRoom> getVisibleRooms(Long projectId, String username, boolean includeArchived) {
        var currentUser = resolveUserByEmailOrUsername(username);
        if (currentUser == null) {
            return List.of();
        }

        var memberRoomIds = chatRoomMemberRepository.findByUserUserId(currentUser.getUserId()).stream()
                .map(roomMember -> roomMember.getChatRoom().getId())
                .distinct()
                .toList();

        return chatRoomRepository.findByProjectId(projectId).stream()
                .filter(room -> room.getCreatedBy() != null && room.getCreatedBy().equalsIgnoreCase(username)
                        || memberRoomIds.contains(room.getId()))
                .filter(room -> includeArchived || !Boolean.TRUE.equals(room.getArchived()))
                .toList();
    }

    private void sendPrivateTypingEventToConversationParticipants(Long projectId,
                                                                  String sender,
                                                                  String recipient,
                                                                  TypingEvent event) {
        var destination = "/queue/project/" + projectId + "/typing/private";
        var aliases = List.of(sender, recipient);

        aliases.stream()
                .filter(alias -> alias != null && !alias.isBlank())
                .map(this::resolveUserByEmailOrUsername)
                .filter(Objects::nonNull)
                .forEach(user -> {
                    if (user.getUsername() != null && !user.getUsername().isBlank()) {
                        simpMessagingTemplate.convertAndSendToUser(user.getUsername().toLowerCase(), destination, event);
                    }
                    if (user.getEmail() != null && !user.getEmail().isBlank()) {
                        simpMessagingTemplate.convertAndSendToUser(user.getEmail().toLowerCase(), destination, event);
                    }
                });
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

    private void publishMentionNotifications(Long projectId, ChatMessage savedMessage, String scope) {
        if (savedMessage == null || savedMessage.getContent() == null || savedMessage.getContent().isBlank()) {
            return;
        }

        var mentions = new LinkedHashSet<String>();
        var matcher = MENTION_PATTERN.matcher(savedMessage.getContent());
        while (matcher.find()) {
            var mention = matcher.group(1);
            if (mention != null && !mention.isBlank()) {
                mentions.add(mention.toLowerCase());
            }
        }

        if (mentions.isEmpty()) {
            return;
        }

        var senderAliases = resolveUserByEmailOrUsername(savedMessage.getSender());
        var senderUsername = senderAliases != null && senderAliases.getUsername() != null
                ? senderAliases.getUsername().toLowerCase()
                : null;
        var senderEmail = senderAliases != null && senderAliases.getEmail() != null
                ? senderAliases.getEmail().toLowerCase()
                : null;

        // Resolve the project name once for use in notification messages.
        String projectName = projectRepository.findById(projectId)
                .map(p -> p.getName()).orElse("the project");

        var destination = "/queue/project/" + projectId + "/mentions";
        var preview = savedMessage.getContent().length() > 120
                ? savedMessage.getContent().substring(0, 120)
                : savedMessage.getContent();

        mentions.forEach(mentioned -> {
            var user = resolveUserByEmailOrUsername(mentioned);
            if (user == null) {
                return;
            }

            var isSender = (senderUsername != null && senderUsername.equalsIgnoreCase(user.getUsername()))
                    || (senderEmail != null && senderEmail.equalsIgnoreCase(user.getEmail()));
            if (isSender) {
                return;
            }

            var isProjectMember = projectRepository.findById(projectId)
                    .flatMap(project -> teamMemberRepository.findByTeamIdAndUserUserId(project.getTeam().getId(), user.getUserId()))
                    .isPresent();
            if (!isProjectMember) {
                return;
            }

            var event = new MentionEvent(
                    "MENTIONED",
                    projectId,
                    savedMessage.getId(),
                    savedMessage.getSender(),
                    scope,
                    savedMessage.getRoomId(),
                    preview);

            // Send the real-time WebSocket mention event (existing behaviour).
            if (user.getUsername() != null && !user.getUsername().isBlank()) {
                simpMessagingTemplate.convertAndSendToUser(user.getUsername().toLowerCase(), destination, event);
            }
            if (user.getEmail() != null && !user.getEmail().isBlank()) {
                simpMessagingTemplate.convertAndSendToUser(user.getEmail().toLowerCase(), destination, event);
            }

            // ── NOTIFICATION: also persist a bell notification for the mention ─
            // The WebSocket event is ephemeral (lost if the user is offline).
            // The persistent notification ensures they see it upon next login.
            // createNotificationIfNotDuplicate guards against duplicate rows when
            // a user is mentioned multiple times in the same message burst.
            String senderDisplay = (senderAliases != null
                    && senderAliases.getFullName() != null
                    && !senderAliases.getFullName().isBlank())
                    ? senderAliases.getFullName() : savedMessage.getSender();
            String notifMessage = senderDisplay + " mentioned you in \"" + projectName + "\" chat";
            String notifLink = "/project/" + projectId + "/chat";
            notificationService.createNotificationIfNotDuplicate(user, notifMessage, notifLink);
            // ─────────────────────────────────────────────────────────────────
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
