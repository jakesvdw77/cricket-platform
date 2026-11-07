package com.cricketlegend.service.support;

import com.cricketlegend.repository.TeamStatsFactsRepository.HeldContributionView;
import com.cricketlegend.repository.TeamStatsFactsRepository.HeldExtentView;
import com.cricketlegend.repository.TeamStatsFactsRepository.HeldResultFactView;
import com.cricketlegend.repository.TeamStatsFactsRepository.MatchReferenceView;
import com.cricketlegend.repository.TeamStatsFactsRepository.TeamFormView;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * docs/specs/116-team-stats.md, "SQL approach" point 6: turns the rows of the team page's facts queries into plain facts for
 * the mapper. It copies values and asks {@link TeamStatsCalculator} how a result reads; it defines no figure.
 */
public final class TeamStatsFactsReader {

    /** The match behind a highest total, lowest total, chase or victory. */
    public record MatchRef(UUID matchId, String opponentName) {
    }

    /** One of the last five counted results; {@code result} is a {@link TeamStatsCalculator.FormResult} name. */
    public record FormFact(
            UUID matchId,
            UUID resultId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            String result,
            boolean forfeit) {
    }

    /** The reference kinds of {@code TeamStatsSql.MATCH_REFERENCES}. */
    public static final String HIGH = "HIGH";

    public static final String LOW = "LOW";
    public static final String CHASE = "CHASE";
    public static final String VICTORY_RUNS = "VICTORY_RUNS";
    public static final String VICTORY_WICKETS = "VICTORY_WICKETS";

    private TeamStatsFactsReader() {}

    /** The form strip, in the order read (newest first). */
    public static List<FormFact> form(List<TeamFormView> rows) {
        return rows.stream()
                .map(row -> {
                    TeamStatsCalculator.FormLine line =
                            TeamStatsCalculator.formLine(row.getOutcome(), row.getWinningSide(), row.getSide());
                    return new FormFact(
                            row.getMatchId(),
                            row.getResultId(),
                            Instant.ofEpochMilli(row.getMatchEpochMillis()),
                            row.getOpponentName(),
                            Boolean.TRUE.equals(row.getDerby()),
                            line.result().name(),
                            line.forfeit());
                })
                .toList();
    }

    /** The match for each kind (the first row per kind; the query orders by match id so a tie is stable). */
    public static Map<String, MatchRef> references(List<MatchReferenceView> rows) {
        Map<String, MatchRef> byKind = new HashMap<>();
        for (MatchReferenceView row : rows) {
            byKind.putIfAbsent(row.getKind(), new MatchRef(row.getMatchId(), row.getOpponentName()));
        }
        return byKind;
    }

    // ---- docs/specs/147: the Player Hub Team stats facts (values copied; every reading is TeamStatsCalculator's) ----

    public static TeamStatsCalculator.ResultFact heldResult(HeldResultFactView v) {
        return new TeamStatsCalculator.ResultFact(
                v.getMatchId(),
                Instant.ofEpochMilli(v.getMatchEpochMillis()),
                v.getOpponentName(),
                v.getOutcome(),
                v.getWinningSide(),
                v.getSide(),
                v.getDecidedBy(),
                v.getMarginType(),
                v.getMarginValue() == null ? null : v.getMarginValue().longValue(),
                v.getTossWonBy(),
                v.getFirstBattingSide());
    }

    public static TeamStatsCalculator.ContributionFact heldContribution(HeldContributionView v) {
        return new TeamStatsCalculator.ContributionFact(
                v.getKind(), v.getProfileId(), v.getPlayerName(), v.getValue() == null ? 0L : v.getValue());
    }

    public static TeamStatsCalculator.Extent heldExtent(HeldExtentView v) {
        if (v == null) {
            return TeamStatsCalculator.Extent.EMPTY;
        }
        return new TeamStatsCalculator.Extent(
                n(v.getOwnUsable()),
                n(v.getOwnWithCard()),
                n(v.getOppUsable()),
                n(v.getOppWithCard()),
                new TeamStatsCounters.Extras(
                        new TeamStatsCounters.Component(n(v.getOwnExtrasInnings()), n(v.getOwnExtras())),
                        new TeamStatsCounters.Component(n(v.getOwnWidesInnings()), n(v.getOwnWides())),
                        new TeamStatsCounters.Component(n(v.getOwnNoBallsInnings()), n(v.getOwnNoBalls())),
                        new TeamStatsCounters.Component(n(v.getOwnByesInnings()), n(v.getOwnByes())),
                        new TeamStatsCounters.Component(n(v.getOwnLegByesInnings()), n(v.getOwnLegByes())),
                        new TeamStatsCounters.Component(n(v.getOwnPenaltyInnings()), n(v.getOwnPenaltyRuns()))),
                n(v.getOwnUsableExtrasInnings()),
                n(v.getOwnUsableExtras()),
                n(v.getOwnUsableExtrasRuns()),
                n(v.getOppUsableExtrasInnings()),
                n(v.getOppUsableExtras()),
                n(v.getOppUsableExtrasRuns()),
                n(v.getPlayersUsed()),
                n(v.getGuestRows()));
    }

    private static long n(Long value) {
        return value == null ? 0L : value;
    }
}
