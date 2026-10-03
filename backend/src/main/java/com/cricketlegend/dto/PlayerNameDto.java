package com.cricketlegend.dto;

/** A player's first and last name, as a side's selection rows display them (docs/specs/076-team-selection.md). */
public record PlayerNameDto(String firstName, String lastName) {
}
