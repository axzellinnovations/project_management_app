package com.planora.backend.dto;

public class SprintVelocityDTO {

    private Long sprintId;
    private String sprintName;
    private int committedPoints;
    private int completedPoints;

    public SprintVelocityDTO(Long sprintId, String sprintName, int committedPoints, int completedPoints) {
        this.sprintId = sprintId;
        this.sprintName = sprintName;
        this.committedPoints = committedPoints;
        this.completedPoints = completedPoints;
    }

    public Long getSprintId() { return sprintId; }
    public String getSprintName() { return sprintName; }
    public int getCommittedPoints() { return committedPoints; }
    public int getCompletedPoints() { return completedPoints; }
}
