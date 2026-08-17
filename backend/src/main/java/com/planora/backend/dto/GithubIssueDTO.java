package com.planora.backend.dto;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GithubIssueDTO {
    private Long id;

    // Persisted integration response fields.
    private Long integrationId;
    private Integer githubIssueNumber;
    private String authorLogin;
    private String githubUrl;
    private Long linkedTaskId;
    private LocalDateTime githubCreatedAt;
    private LocalDateTime githubUpdatedAt;

    // GitHub REST issue response fields.
    private Integer number;
    private String title;
    private String body;
    private String state;
    private List<GithubLabelDTO> labels;
    @JsonDeserialize(contentUsing = AssigneeLoginDeserializer.class)
    private List<String> assignees;
    @JsonProperty("created_at")
    private OffsetDateTime createdAt;
    @JsonProperty("updated_at")
    private OffsetDateTime updatedAt;
    @JsonProperty("html_url")
    private String htmlUrl;
    private Integer comments;
    @JsonProperty("pull_request")
    private JsonNode pullRequest;

    public boolean isPullRequest() {
        return pullRequest != null && !pullRequest.isNull() && !pullRequest.isMissingNode();
    }

    public static class AssigneeLoginDeserializer extends StdDeserializer<String> {
        public AssigneeLoginDeserializer() {
            super(String.class);
        }

        @Override
        public String deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            JsonNode assignee = parser.getCodec().readTree(parser);
            return assignee.path("login").asText();
        }
    }
}
