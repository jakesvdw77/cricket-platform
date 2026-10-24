package com.cricketlegend.service.support;

/**
 * The minimised view of a matched player, built by {@code LinkService} and mapped to the response DTOs. Deliberately
 * carries no full date of birth: only the birth year and a server-computed adult flag (docs/specs/119, Decision 28).
 */
public record MatchedPlayer(
        String ref,
        java.util.UUID clubId,
        String firstName,
        String surnameInitial,
        String clubName,
        String groupLabel,
        Integer birthYear,
        boolean adult,
        String mainAgentEmail) {}
