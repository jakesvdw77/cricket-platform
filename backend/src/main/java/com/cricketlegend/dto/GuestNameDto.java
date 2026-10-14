package com.cricketlegend.dto;

import java.time.Instant;

/** docs/specs/101: a guest name the club has used before, for the name field's suggestions. */
public record GuestNameDto(String displayName, long uses, Instant lastUsed) {
}
