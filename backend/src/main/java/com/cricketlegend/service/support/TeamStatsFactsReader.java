package com.cricketlegend.service.support;

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
}
