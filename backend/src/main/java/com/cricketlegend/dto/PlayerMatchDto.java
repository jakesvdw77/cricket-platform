package com.cricketlegend.dto;

/**
 * One player on record under the caller's verified email, minimised (docs/specs/119, Decision 28): never a full date of
 * birth, phone, address, medical details or photo. {@code ref} is the opaque reference sent back to confirm.
 */
public record PlayerMatchDto(
        String ref,
        String firstName,
        String surnameInitial,
        String clubName,
        String groupLabel,
        Integer birthYear,
        boolean adult) {}
