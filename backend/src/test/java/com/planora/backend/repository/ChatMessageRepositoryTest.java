package com.planora.backend.repository;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import com.planora.backend.model.ChatMessage;

@DataJpaTest
class ChatMessageRepositoryTest {

    @Autowired
    private ChatMessageRepository repository;

    @Test
    @DisplayName("should save and retrieve public message")
    void saveAndFindPublic() {
        ChatMessage msg = new ChatMessage();
        msg.setType(ChatMessage.MessageType.CHAT);
        msg.setContent("hello public");
        msg.setSender("alice");
        msg.setRecipient(null);
        repository.save(msg);

        List<ChatMessage> list = repository.findByRecipientIsNullOrderByIdAsc();
        assertThat(list).isNotEmpty();
        assertThat(list.get(0).getContent()).isEqualTo("hello public");
    }

    @Test
    @DisplayName("should retrieve conversation between two users")
    void conversationQuery() {
        ChatMessage m1 = new ChatMessage();
        m1.setType(ChatMessage.MessageType.CHAT);
        m1.setSender("bob");
        m1.setRecipient("carol");
        m1.setContent("hi carol");
        repository.save(m1);

        ChatMessage m2 = new ChatMessage();
        m2.setType(ChatMessage.MessageType.CHAT);
        m2.setSender("carol");
        m2.setRecipient("bob");
        m2.setContent("hello bob");
        repository.save(m2);

        List<ChatMessage> conv = repository.findConversation("bob", "carol");
        assertThat(conv).hasSize(2);
        assertThat(conv).extracting(ChatMessage::getContent)
                .containsExactly("hi carol", "hello bob");
    }
}