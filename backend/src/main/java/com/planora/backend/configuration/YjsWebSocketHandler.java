package com.planora.backend.configuration;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class YjsWebSocketHandler extends BinaryWebSocketHandler {

    private final ConcurrentHashMap<String, CopyOnWriteArraySet<WebSocketSession>> rooms
            = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String roomId = extractRoomId(session);
        rooms.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>()).add(session);
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        String roomId = extractRoomId(session);
        Set<WebSocketSession> room = rooms.getOrDefault(roomId, new CopyOnWriteArraySet<>());
        for (WebSocketSession peer : room) {
            if (peer.isOpen() && !peer.getId().equals(session.getId())) {
                try {
                    peer.sendMessage(message);
                } catch (IOException e) {
                    // peer disconnected mid-send, ignore
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomId = extractRoomId(session);
        Set<WebSocketSession> room = rooms.get(roomId);
        if (room != null) {
            room.remove(session);
            if (room.isEmpty()) rooms.remove(roomId);
        }
    }

    private String extractRoomId(WebSocketSession session) {
        String path = session.getUri().getPath(); // e.g. /yjs/page-42
        String[] parts = path.split("/");
        return parts[parts.length - 1];
    }
}
