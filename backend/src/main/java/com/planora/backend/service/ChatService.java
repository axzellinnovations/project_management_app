package com.planora.backend.service;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;

import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatReadState;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.repository.ChatMessageRepository;
import com.planora.backend.repository.ChatReadStateRepository;
import com.planora.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ChatService {
    private final ChatMessageRepository chatMessageRepository;
    private final ChatReadStateRepository chatReadStateRepository;
    private final UserRepository userRepository;

    public record RoomChatSummary(Long roomId, String lastMessage, String lastMessageSender, String lastMessageTimestamp, long unseenCount) {}

    public record DirectChatSummary(String username, String lastMessage, String lastMessageSender, String lastMessageTimestamp, long unseenCount) {}

    /**
     * Persist a chat message.
     */
    @SuppressWarnings("null")
    public ChatMessage saveMessage(ChatMessage message) {
        return chatMessageRepository.save(message);
    }

    /**
     * Retrieve all group messages for a project (no recipient, no room).
     */
    public List<ChatMessage> getGroupMessages(Long projectId) {
        return chatMessageRepository.findByProjectIdAndRecipientIsNullAndRoomIdIsNullOrderByIdAsc(projectId);
    }

    /**
     * Retrieve room messages for a given room.
     */
    public List<ChatMessage> getRoomMessages(Long projectId, Long roomId) {
        return chatMessageRepository.findByProjectIdAndRoomIdOrderByIdAsc(projectId, roomId);
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

        var latestMessage = chatMessageRepository.findTopByProjectIdAndRoomIdOrderByIdDesc(projectId, roomId);
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

    public List<RoomChatSummary> buildRoomSummaries(Long projectId, String currentUser, List<ChatRoom> rooms) {
        var currentUserEntity = resolveUserByEmailOrUsername(currentUser);
        if (currentUserEntity == null) {
            return List.of();
        }

        var currentUserAliases = resolveUserAliases(currentUser);

        return rooms.stream()
                .map(room -> {
                    var latestMessage = chatMessageRepository.findTopByProjectIdAndRoomIdOrderByIdDesc(projectId, room.getId()).orElse(null);
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
        var byEmail = userRepository.findByEmailIgnoreCase(normalized).orElse(null);
        if (byEmail != null) {
            return byEmail;
        }

        return userRepository.findByUsernameIgnoreCase(normalized).orElse(null);
    }
}
