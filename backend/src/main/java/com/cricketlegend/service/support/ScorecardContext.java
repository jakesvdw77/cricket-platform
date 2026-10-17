package com.cricketlegend.service.support;

import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ScorecardSelectionState;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * docs/specs/101: what the scorecard rules need that is not in the draft, loaded by the service: the league's maximum
 * balls per bowler, each side's squad for the match's season (a side absent from {@code squadBySide} is not checked),
 * the club's registered players by normalised name (for {@code GUEST_NAME_MATCHES_PLAYER}) and display names of the
 * linked players (for messages), and the selection state of each ours side (for the not-selected notice; a side absent
 * from {@code selectionBySide} is not checked). {@code leagueName} names the league whose limits apply, so a message about a
 * limit can say which league it is (null when there is none). {@code eligibilityProblems} (docs/specs/113) holds, per
 * side, the registered players of our side who are not in the team's section or fail the league's age rule.
 */
public record ScorecardContext(
        Integer maxBallsPerBowler,
        Map<ResultSide, Set<UUID>> squadBySide,
        Map<String, UUID> registeredPlayersByName,
        Map<UUID, String> playerNames,
        Map<ResultSide, ScorecardSelectionState> selectionBySide,
        String leagueName,
        Map<ResultSide, Map<UUID, List<ResultPlayerEligibility.Problem>>> eligibilityProblems) {

    /**
     * The context without eligibility problems (docs/specs/113: the section and age problems of the registered players
     * of our sides, per side; empty means none found or none computed).
     */
    public ScorecardContext(
            Integer maxBallsPerBowler,
            Map<ResultSide, Set<UUID>> squadBySide,
            Map<String, UUID> registeredPlayersByName,
            Map<UUID, String> playerNames,
            Map<ResultSide, ScorecardSelectionState> selectionBySide,
            String leagueName) {
        this(maxBallsPerBowler, squadBySide, registeredPlayersByName, playerNames, selectionBySide, leagueName, Map.of());
    }

    /** The context without a league name (the league's name is only used to word a message). */
    public ScorecardContext(
            Integer maxBallsPerBowler,
            Map<ResultSide, Set<UUID>> squadBySide,
            Map<String, UUID> registeredPlayersByName,
            Map<UUID, String> playerNames,
            Map<ResultSide, ScorecardSelectionState> selectionBySide) {
        this(maxBallsPerBowler, squadBySide, registeredPlayersByName, playerNames, selectionBySide, null);
    }

    /** No extra context: the rules that need none still run. */
    public static ScorecardContext none() {
        return new ScorecardContext(null, Map.of(), Map.of(), Map.of(), Map.of());
    }

    /** The lower-cased, trimmed, whitespace-collapsed form names are compared in. */
    public static String normalise(String name) {
        return name == null ? "" : name.trim().replaceAll("\\s+", " ").toLowerCase(java.util.Locale.ROOT);
    }
}
