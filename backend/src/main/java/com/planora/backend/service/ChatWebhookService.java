package com.planora.backend.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.model.ChatMessage;

import lombok.extern.slf4j.Slf4j;

// TODO: Wire this service to a ChatWebhookController when webhook integration is ready.
// Currently this class is unreachable from any controller.
@Service
@Slf4j
public class ChatWebhookService {

    public record ChatWebhook(String id,
                              String url,
                              List<String> events,
                              boolean active,
                              String secret,
                              String createdAt) {}

    public record WebhookDispatchPayload(String eventType,
                                         Long projectId,
                                         String scope,
                                         Long messageId,
                                         String sender,
                                         String recipient,
                                         Long roomId,
                                         String content,
                                         String timestamp) {}

    private final Map<Long, Map<String, ChatWebhook>> webhooksByProject = new ConcurrentHashMap<>();
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<ChatWebhook> listWebhooks(Long projectId) {
        return webhooksByProject.getOrDefault(projectId, Map.of()).values().stream().toList();
    }

    public ChatWebhook createWebhook(Long projectId, String url, List<String> events, Boolean active, String secret) {
        var normalizedEvents = (events == null || events.isEmpty())
                ? List.of("MESSAGE_CREATED", "MESSAGE_UPDATED", "MESSAGE_DELETED")
                : events.stream().filter(value -> value != null && !value.isBlank()).map(String::trim).map(String::toUpperCase).distinct().toList();

        var webhook = new ChatWebhook(
                UUID.randomUUID().toString(),
                url,
                normalizedEvents,
                active == null || active,
                secret,
                LocalDateTime.now().toString());

        webhooksByProject.computeIfAbsent(projectId, key -> new ConcurrentHashMap<>()).put(webhook.id(), webhook);
        return webhook;
    }

    public boolean deleteWebhook(Long projectId, String webhookId) {
        var projectHooks = webhooksByProject.get(projectId);
        if (projectHooks == null) {
            return false;
        }
        return projectHooks.remove(webhookId) != null;
    }

    public int testWebhooks(Long projectId) {
        var hooks = listWebhooks(projectId);
        var payload = new WebhookDispatchPayload(
                "WEBHOOK_TEST",
                projectId,
                "TEAM",
                null,
                "system",
                null,
                null,
                "test-payload",
                LocalDateTime.now().toString());
        hooks.forEach(hook -> dispatchToWebhook(hook, payload));
        return hooks.size();
    }

    public void dispatchMessageEvent(Long projectId, String eventType, String scope, ChatMessage message) {
        var hooks = listWebhooks(projectId);
        if (hooks.isEmpty() || message == null) {
            return;
        }

        var payload = new WebhookDispatchPayload(
                eventType,
                projectId,
                scope,
                message.getId(),
                message.getSender(),
                message.getRecipient(),
                message.getRoomId(),
                message.getContent(),
                message.getTimestamp() != null ? message.getTimestamp().toString() : null);

        hooks.stream()
                .filter(ChatWebhook::active)
                .filter(hook -> hook.events().stream().anyMatch(event -> event.equalsIgnoreCase(eventType)))
                .forEach(hook -> dispatchToWebhook(hook, payload));
    }

    private void dispatchToWebhook(ChatWebhook hook, WebhookDispatchPayload payload) {
        try {
            var requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(hook.url()))
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)));

            if (hook.secret() != null && !hook.secret().isBlank()) {
                requestBuilder.header("X-Chat-Webhook-Secret", hook.secret());
            }

            httpClient.sendAsync(requestBuilder.build(), HttpResponse.BodyHandlers.discarding())
                    .exceptionally(error -> {
                        log.warn("Webhook dispatch failed: {}", error.getMessage());
                        return null;
                    });
        } catch (JsonProcessingException | IllegalArgumentException ex) {
            log.warn("Failed to build webhook request: {}", ex.getMessage());
        }
    }
}
