package com.planora.backend.dto;

public class BurndownPoint {
    private int day;
    private int remaining;

    public BurndownPoint(int day, int remaining) {
        this.day = day;
        this.remaining = remaining;
    }

    public int getDay() { return day; }
    public int getRemaining() { return remaining; }
}