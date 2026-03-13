package com.planora.backend.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.planora.backend.model.ChatMessage;
import com.planora.backend.repository.ChatMessageRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ChatService {
    private final ChatMessageRepository chatMessageRepository;

    /**
     * Persist a chat message.
     */
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
        return chatMessageRepository.findConversation(projectId, user.toLowerCase(), other.toLowerCase());
    }
}
