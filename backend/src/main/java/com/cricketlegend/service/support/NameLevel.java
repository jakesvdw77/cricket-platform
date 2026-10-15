package com.cricketlegend.service.support;

/**
 * How firmly a written name was placed (docs/specs/104, exactness levels). {@code EXACT} is identity (or a
 * remembered alias); {@code NORMALISED} is a deterministic rule that is not identity (spacing, word order,
 * initials, prefixes) and is therefore a guess the manager confirms; {@code UNRESOLVED} was not placed.
 * {@code AI_SUGGESTED} is deliberately absent: no AI tier exists in this revision.
 */
public enum NameLevel {
    EXACT,
    NORMALISED,
    UNRESOLVED
}
