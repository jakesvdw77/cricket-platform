package com.cricketlegend.dto;

import java.util.UUID;

/** A matched player that already has a main agent: the same minimum plus the main agent's masked email (Decision 15). */
public record PlayerMatchWithMainAgentDto(
        String ref,
        UUID clubId,
        String firstName,
        String surnameInitial,
        String clubName,
        String groupLabel,
        Integer birthYear,
        boolean adult,
        String maskedMainAgentEmail) {}
