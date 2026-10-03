package com.cricketlegend.service.support;

import com.cricketlegend.domain.SelectionAvailability;
import com.cricketlegend.service.MatchPollCoverageService;
import java.util.Map;
import java.util.UUID;

/**
 * The result of evaluating a set of candidate players for one side of a match
 * (docs/specs/076-team-selection.md): the covering poll, who each player is, their availability, who
 * holds them for the slot, and the single rejection (by precedence) each blocked player gets.
 * Players absent from {@code rejections} may be selected.
 */
public record SelectionEvaluation(
        MatchPollCoverageService.Coverage coverage,
        Map<UUID, SelectionEligibility.PlayerInfo> players,
        Map<UUID, SelectionAvailability> availability,
        Map<UUID, TakenBy> taken,
        Map<UUID, SelectionRejection> rejections) {
}
