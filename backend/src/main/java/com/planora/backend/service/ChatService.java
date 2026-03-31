package com.planora.backend.service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatReaction;
import com.planora.backend.model.ChatReadState;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.model.ChatThread;
import com.planora.backend.repository.ChatMessageRepository;
import com.planora.backend.repository.ChatReactionRepository;
import com.planora.backend.repository.ChatReadStateRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.ChatThreadRepository;
import com.planora.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ChatService {
    private static final String TEAM_CHAT_READ_KEY = "__TEAM_CHAT__";

    private final ChatMessageRepository chatMessageRepository;
    private final ChatReadStateRepository chatReadStateRepository;
    private final ChatThreadRepository chatThreadRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatReactionRepository chatReactionRepository;
    private final UserRepository userRepository;
    private final ChatDocumentService chatDocumentService;

    public record RoomChatSummary(Long roomId, String lastMessage, String lastMessageSender, String lastMessageTimestamp, long unseenCount) {}

    public record DirectChatSummary(String username, String lastMessage, String lastMessageSender, String lastMessageTimestamp, long unseenCount) {}

    public record TeamChatSummary(String lastMessage, String lastMessageSender, String lastMessageTimestamp, long unseenCount) {}

    public record UnreadBadgeSummary(long teamUnread, long roomsUnread, long directsUnread, long totalUnread) {}

    public record ChatReactionSummary(String emoji, long count, boolean reactedByCurrentUser) {}

    /**
     * Persist a chat message.
     */
    @SuppressWarnings("null")
    public ChatMessage saveMessage(ChatMessage message) {
        if (message.getFormatType() == null) {
            message.setFormatType(ChatMessage.FormatType.PLAIN);
        }
        return chatMessageRepository.save(message);
    }

    public List<ChatMessage> getThreadMessages(Long projectId, Long rootMessageId) {
        var root = chatMessageRepository.findByIdAndProjectId(rootMessageId, projectId)
                .orElseThrow(() -> new RuntimeException("Thread root message not found"));

        var replies = chatMessageRepository.findByProjectIdAndParentMessageIdOrderByIdAsc(projectId, rootMessageId);
        return Stream.concat(Stream.of(root), replies.stream()).toList();
    }

    public Optional<Long> resolveThreadTopicRootId(Long projectId, ChatMessage message) {
        if (message == null || message.getId() == null) {
            return Optional.empty();
        }

        if (message.getParentMessageId() != null) {
            return Optional.of(message.getParentMessageId());
        }

        return chatThreadRepository.findByProjectIdAndRootMessageId(projectId, message.getId())
                .map(thread -> thread.getRootMessageId());
    }

    public ChatMessage saveThreadReply(Long projectId, Long rootMessageId, ChatMessage replyMessage) {
        var root = chatMessageRepository.findByIdAndProjectId(rootMessageId, projectId)
                .orElseThrow(() -> new RuntimeException("Thread root message not found"));

        if (root.getRoomId() != null) {
            var room = chatRoomRepository.findById(root.getRoomId())
                    .orElseThrow(() -> new RuntimeException("Chat room not found"));
            if (Boolean.TRUE.equals(room.getArchived())) {
                throw new RuntimeException("Channel is archived and read-only");
            }
        }

        if (replyMessage.getFormatType() == null) {
            replyMessage.setFormatType(ChatMessage.FormatType.PLAIN);
        }

        replyMessage.setParentMessageId(rootMessageId);
        replyMessage.setProjectId(projectId);
        replyMessage.setRoomId(root.getRoomId());
        replyMessage.setChatType(root.getChatType());
        replyMessage.setRecipient(root.getRecipient());

        var saved = chatMessageRepository.save(replyMessage);

        chatThreadRepository.findByProjectIdAndRootMessageId(projectId, rootMessageId)
                .orElseGet(() -> {
                    var thread = new ChatThread();
                    thread.setProjectId(projectId);
                    thread.setRootMessageId(rootMessageId);
                    thread.setRoomId(root.getRoomId());
                    thread.setCreatedBy(saved.getSender());
                    return chatThreadRepository.save(thread);
                });

        return saved;
    }

    public ChatMessage editMessage(Long projectId, Long messageId, String actor, String content, ChatMessage.FormatType formatType) {
        if (content == null || content.trim().isEmpty()) {
            throw new RuntimeException("Message content is required");
        }

        var message = chatMessageRepository.findByIdAndProjectId(messageId, projectId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        ensureMessageOwnership(message, actor);
        if (Boolean.TRUE.equals(message.getDeleted())) {
            throw new RuntimeException("Cannot edit a deleted message");
        }

        message.setContent(content.trim());
        message.setFormatType(formatType != null ? formatType : ChatMessage.FormatType.PLAIN);
        message.setEditedAt(LocalDateTime.now());
        return chatMessageRepository.save(message);
    }

    public ChatMessage softDeleteMessage(Long projectId, Long messageId, String actor) {
        var message = chatMessageRepository.findByIdAndProjectId(messageId, projectId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        ensureMessageOwnership(message, actor);

        if (message.getContent() != null && message.getContent().startsWith("http")) {
            chatDocumentService.deleteChatDocument(message.getContent());
        }

        message.setDeleted(true);
        message.setDeletedAt(LocalDateTime.now());
        message.setContent("[message deleted]");
        return chatMessageRepository.save(message);
    }

    @Transactional(readOnly = true)
    public List<ChatReactionSummary> getMessageReactions(Long projectId, Long messageId, String currentUser) {
        chatMessageRepository.findByIdAndProjectId(messageId, projectId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        var currentAliases = resolveUserAliases(currentUser);
        Map<String, Long> counts = new LinkedHashMap<>();
        Map<String, Boolean> reactedByCurrentUser = new LinkedHashMap<>();

        chatReactionRepository.findWithUserByMessageIdOrderByCreatedAtAsc(messageId).forEach(reaction -> {
            var emoji = reaction.getEmoji();
            if (emoji == null || emoji.isBlank()) {
                return;
            }

            counts.put(emoji, counts.getOrDefault(emoji, 0L) + 1L);

            var reactionUser = reaction.getUser();
            if (reactionUser != null) {
                var reactionAliases = Stream.of(reactionUser.getUsername(), reactionUser.getEmail())
                        .filter(value -> value != null && !value.isBlank())
                        .map(String::toLowerCase)
                        .toList();

                if (!reactionAliases.isEmpty() && reactionAliases.stream().anyMatch(currentAliases::contains)) {
                    reactedByCurrentUser.put(emoji, true);
                }
            }
        });

        return counts.entrySet().stream()
                .map(entry -> new ChatReactionSummary(entry.getKey(), entry.getValue(), reactedByCurrentUser.getOrDefault(entry.getKey(), false)))
                .toList();
    }

    @SuppressWarnings("null")
    @Transactional
    public List<ChatReactionSummary> toggleReaction(Long projectId, Long messageId, String actor, String emoji) {
        if (emoji == null || emoji.isBlank()) {
            throw new RuntimeException("Emoji is required");
        }

        var message = chatMessageRepository.findByIdAndProjectId(messageId, projectId)
                .orElseThrow(() -> new RuntimeException("Message not found"));
        var actorUser = resolveUserByEmailOrUsername(actor);
        if (actorUser == null) {
            throw new RuntimeException("User not found");
        }

        var normalizedEmoji = emoji.trim();
        var existing = chatReactionRepository.findByMessageIdAndUserUserIdAndEmoji(messageId, actorUser.getUserId(), normalizedEmoji);

        if (existing.isPresent()) {
            chatReactionRepository.delete(existing.get());
        } else {
            var reaction = new ChatReaction();
            reaction.setMessage(message);
            reaction.setUser(actorUser);
            reaction.setEmoji(normalizedEmoji);
            chatReactionRepository.save(reaction);
        }

        return getMessageReactions(projectId, messageId, actor);
    }

    /**
     * Retrieve all group messages for a project (no recipient, no room).
     */
    public List<ChatMessage> getGroupMessages(Long projectId) {
        return chatMessageRepository.findByProjectIdAndRecipientIsNullAndRoomIdIsNullAndParentMessageIdIsNullOrderByIdAsc(projectId);
    }

    /**
     * Retrieve room messages for a given room.
     */
    public List<ChatMessage> getRoomMessages(Long projectId, Long roomId) {
        return chatMessageRepository.findByProjectIdAndRoomIdAndParentMessageIdIsNullOrderByIdAsc(projectId, roomId);
    }

    /**
     * Retrieve the private conversation between two users in a project.
     */
    public List<ChatMessage> getPrivateConversation(Long projectId, String user, String other) {
        if (user == null || other == null) {
            return List.of();
        }

        return chatMessageRepository.findConversationByAliases(
                projectId,
                resolveUserAliases(user),
                resolveUserAliases(other));
    }

    public void markRoomAsRead(Long projectId, Long roomId, String usernameOrEmail) {
        var user = resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            return;
        }

        var latestMessage = chatMessageRepository.findTopByProjectIdAndRoomIdAndParentMessageIdIsNullOrderByIdDesc(projectId, roomId);
        if (latestMessage.isEmpty()) {
            return;
        }

        var readState = chatReadStateRepository.findByProjectIdAndUserUserIdAndRoomId(projectId, user.getUserId(), roomId)
                .orElseGet(ChatReadState::new);

        readState.setProjectId(projectId);
        readState.setUser(user);
        readState.setRoomId(roomId);
        readState.setOtherParticipant(null);
        readState.setLastReadMessageId(latestMessage.get().getId());
        chatReadStateRepository.save(readState);
    }

    public void markPrivateConversationAsRead(Long projectId, String usernameOrEmail, String otherParticipant) {
        var user = resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null || otherParticipant == null || otherParticipant.isBlank()) {
            return;
        }

        var normalizedOtherParticipant = resolveCanonicalChatUser(otherParticipant);
        var latestMessage = findLatestConversationMessage(projectId, resolveUserAliases(usernameOrEmail), resolveUserAliases(otherParticipant));
        if (latestMessage.isEmpty()) {
            return;
        }

        var readState = chatReadStateRepository
                .findByProjectIdAndUserUserIdAndOtherParticipantIgnoreCase(projectId, user.getUserId(), normalizedOtherParticipant)
                .orElseGet(ChatReadState::new);

        readState.setProjectId(projectId);
        readState.setUser(user);
        readState.setRoomId(null);
        readState.setOtherParticipant(normalizedOtherParticipant);
        readState.setLastReadMessageId(latestMessage.get().getId());
        chatReadStateRepository.save(readState);
    }

    public void markTeamAsRead(Long projectId, String usernameOrEmail) {
        var user = resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            return;
        }

        var latestMessage = chatMessageRepository.findTopByProjectIdAndRecipientIsNullAndRoomIdIsNullAndParentMessageIdIsNullOrderByIdDesc(projectId);
        if (latestMessage.isEmpty()) {
            return;
        }

        var readState = chatReadStateRepository
                .findByProjectIdAndUserUserIdAndOtherParticipantIgnoreCase(projectId, user.getUserId(), TEAM_CHAT_READ_KEY)
                .orElseGet(ChatReadState::new);

        readState.setProjectId(projectId);
        readState.setUser(user);
        readState.setRoomId(null);
        readState.setOtherParticipant(TEAM_CHAT_READ_KEY);
        readState.setLastReadMessageId(latestMessage.get().getId());
        chatReadStateRepository.save(readState);
    }

    public TeamChatSummary buildTeamSummary(Long projectId, String currentUser) {
        var currentUserEntity = resolveUserByEmailOrUsername(currentUser);
        if (currentUserEntity == null) {
            return new TeamChatSummary(null, null, null, 0);
        }

        var latestMessage = chatMessageRepository.findTopByProjectIdAndRecipientIsNullAndRoomIdIsNullAndParentMessageIdIsNullOrderByIdDesc(projectId).orElse(null);
        var readState = chatReadStateRepository
                .findByProjectIdAndUserUserIdAndOtherParticipantIgnoreCase(projectId, currentUserEntity.getUserId(), TEAM_CHAT_READ_KEY)
                .orElse(null);
        var unseenCount = chatMessageRepository.countUnreadTeamMessagesByAliases(
                projectId,
                resolveUserAliases(currentUser),
                readState != null ? readState.getLastReadMessageId() : null);

        return new TeamChatSummary(
                latestMessage != null ? latestMessage.getContent() : null,
                latestMessage != null ? latestMessage.getSender() : null,
                latestMessage != null && latestMessage.getTimestamp() != null ? latestMessage.getTimestamp().toString() : null,
                unseenCount);
    }

    public UnreadBadgeSummary buildUnreadBadge(Long projectId, String currentUser, List<ChatRoom> rooms, List<String> participants) {
        var teamSummary = buildTeamSummary(projectId, currentUser);
        var roomSummaries = buildRoomSummaries(projectId, currentUser, rooms);
        var directSummaries = buildDirectSummaries(projectId, currentUser, participants);

        long teamUnread = teamSummary.unseenCount();
        long roomUnread = roomSummaries.stream().mapToLong(RoomChatSummary::unseenCount).sum();
        long directUnread = directSummaries.stream().mapToLong(DirectChatSummary::unseenCount).sum();

        return new UnreadBadgeSummary(
                teamUnread,
                roomUnread,
                directUnread,
                teamUnread + roomUnread + directUnread);
    }

    public List<ChatMessage> searchMessages(Long projectId,
                                            String currentUser,
                                            String query,
                                            Set<Long> visibleRoomIds,
                                            int limit) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        var normalized = query.trim().toLowerCase();
        var currentAliases = resolveUserAliases(currentUser);

        return chatMessageRepository.searchMessages(projectId, normalized).stream()
                .filter(message -> isMessageVisibleToUser(message, currentAliases, visibleRoomIds))
                .limit(Math.max(1, limit))
                .toList();
    }

    private boolean isMessageVisibleToUser(ChatMessage message, List<String> currentAliases, Set<Long> visibleRoomIds) {
        if (message.getRoomId() != null) {
            return visibleRoomIds.contains(message.getRoomId());
        }

        if (message.getRecipient() != null && !message.getRecipient().isBlank()) {
            var sender = message.getSender() != null ? message.getSender().toLowerCase() : "";
            var recipient = message.getRecipient().toLowerCase();
            return currentAliases.contains(sender) || currentAliases.contains(recipient);
        }

        return true;
    }

    public List<RoomChatSummary> buildRoomSummaries(Long projectId, String currentUser, List<ChatRoom> rooms) {
        var currentUserEntity = resolveUserByEmailOrUsername(currentUser);
        if (currentUserEntity == null) {
            return List.of();
        }

        var currentUserAliases = resolveUserAliases(currentUser);

        return rooms.stream()
                .map(room -> {
                    var latestMessage = chatMessageRepository.findTopByProjectIdAndRoomIdAndParentMessageIdIsNullOrderByIdDesc(projectId, room.getId()).orElse(null);
                    var readState = chatReadStateRepository.findByProjectIdAndUserUserIdAndRoomId(projectId, currentUserEntity.getUserId(), room.getId()).orElse(null);
                    var unseenCount = chatMessageRepository.countUnreadRoomMessagesByAliases(
                            projectId,
                            room.getId(),
                            currentUserAliases,
                            readState != null ? readState.getLastReadMessageId() : null);

                    return new RoomChatSummary(
                            room.getId(),
                            latestMessage != null ? latestMessage.getContent() : null,
                            latestMessage != null ? latestMessage.getSender() : null,
                            latestMessage != null && latestMessage.getTimestamp() != null ? latestMessage.getTimestamp().toString() : null,
                            unseenCount);
                })
                .sorted(Comparator.comparing((RoomChatSummary summary) -> summary.lastMessageTimestamp() == null ? "" : summary.lastMessageTimestamp()).reversed())
                .toList();
    }

    public List<DirectChatSummary> buildDirectSummaries(Long projectId, String currentUser, List<String> participants) {
        var currentUserEntity = resolveUserByEmailOrUsername(currentUser);
        if (currentUserEntity == null) {
            return List.of();
        }

        var currentUsername = currentUserEntity.getUsername() != null ? currentUserEntity.getUsername().toLowerCase() : null;
        var currentEmail = currentUserEntity.getEmail() != null ? currentUserEntity.getEmail().toLowerCase() : null;
        var currentUserAliases = resolveUserAliases(currentUser);

        return participants.stream()
                .filter(participant -> participant != null && !participant.isBlank())
                .map(String::toLowerCase)
            .filter(participant -> !currentUserAliases.contains(participant))
                .filter(participant -> currentUsername == null || !participant.equals(currentUsername))
                .filter(participant -> currentEmail == null || !participant.equals(currentEmail))
                .distinct()
                .map(participant -> {
                var latestMessage = findLatestConversationMessage(projectId, currentUserAliases, resolveUserAliases(participant)).orElse(null);
                    var readState = chatReadStateRepository
                            .findByProjectIdAndUserUserIdAndOtherParticipantIgnoreCase(projectId, currentUserEntity.getUserId(), participant)
                            .orElse(null);
                var unseenCount = chatMessageRepository.countUnreadPrivateMessagesByAliases(
                            projectId,
                    resolveUserAliases(participant),
                    currentUserAliases,
                            readState != null ? readState.getLastReadMessageId() : null);

                    return new DirectChatSummary(
                            participant,
                            latestMessage != null ? latestMessage.getContent() : null,
                            latestMessage != null ? latestMessage.getSender() : null,
                            latestMessage != null && latestMessage.getTimestamp() != null ? latestMessage.getTimestamp().toString() : null,
                            unseenCount);
                })
                .sorted(Comparator.comparing((DirectChatSummary summary) -> summary.lastMessageTimestamp() == null ? "" : summary.lastMessageTimestamp()).reversed())
                .toList();
    }

    private Optional<ChatMessage> findLatestConversationMessage(Long projectId, List<String> userAliases, List<String> otherAliases) {
        return chatMessageRepository.findLatestConversationMessagesByAliases(projectId, userAliases, otherAliases)
                .stream()
                .findFirst();
    }

    private List<String> resolveUserAliases(String usernameOrEmail) {
        var user = resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            return List.of(usernameOrEmail.toLowerCase());
        }

        return Stream.of(user.getUsername(), user.getEmail(), usernameOrEmail)
                .filter(value -> value != null && !value.isBlank())
                .map(String::toLowerCase)
                .distinct()
                .toList();
    }

    private String resolveCanonicalChatUser(String usernameOrEmail) {
        var user = resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            return usernameOrEmail.toLowerCase();
        }

        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername().toLowerCase();
        }

        return user.getEmail().toLowerCase();
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

    private void ensureMessageOwnership(ChatMessage message, String actor) {
        if (message.getSender() == null) {
            throw new RuntimeException("Message sender is missing");
        }

        var actorAliases = resolveUserAliases(actor);
        if (!actorAliases.contains(message.getSender().toLowerCase())) {
            throw new RuntimeException("Only the original sender can modify this message");
        }
    }
}
