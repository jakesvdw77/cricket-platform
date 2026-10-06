package com.cricketlegend.dto;

/**
 * How many players a side's selection may hold (docs/specs/076-team-selection.md section 4):
 * {@code battingPlaces} ordered places, an optional 12th man where {@code twelfthManAllowed}, and
 * {@code maxSelected} = places plus the 12th man place (never above 12).
 */
public record SelectionLimitsDto(int battingPlaces, boolean twelfthManAllowed, int maxSelected) {
}
