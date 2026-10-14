package com.cricketlegend.dto;

import java.time.Instant;

/**
 * docs/specs/101: an opposition name used in an earlier fixture against the same opposition, offered as a suggestion on
 * the Teams step. Text only: no identity, no statistics. {@code lastMatchDate} is the date of the latest such fixture.
 */
public record OppositionNameDto(String displayName, long uses, Instant lastMatchDate) {
}
