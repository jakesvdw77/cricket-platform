package com.cricketlegend.dto;

/** A matched player that already has a main agent: the same minimum plus the main agent's masked email (Decision 15). */
public record PlayerMatchWithMainAgentDto(
        String ref,
        String firstName,
        String surnameInitial,
        String clubName,
        String groupLabel,
        Integer birthYear,
        boolean adult,
        String maskedMainAgentEmail) {}
