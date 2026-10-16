package com.cricketlegend.dto;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.TossDecision;
import com.cricketlegend.service.adaptor.AdaptorType;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/104-match-results-import-adaptors.md, "The common import format (version 1)": the one document an adaptor
 * produces and the Result Processor accepts. Built from the {@code ResultDraft} / {@code ScorecardDto} shapes but with
 * names instead of ids and teams referenced by a short key. Shape and reference rules are {@code
 * ImportedResultValidator}'s; cricket arithmetic is {@code ResultValidator}'s. Every {@code exactness} is output-only
 * and recomputed by the processor.
 */
public record ImportedResultDto(
        Integer schemaVersion,
        Source source,
        Match match,
        List<Team> teams,
        Toss toss,
        Result result,
        List<Innings> innings,
        List<PlayerEntry> players,
        Awards awards) {

    public static final int SCHEMA_VERSION = 1;

    /**
     * {@code adaptor} and {@code fileName} are set by the adaptor base class, not trusted from input; {@code provider}
     * with {@code externalMatchId} is the idempotency key.
     */
    public record Source(AdaptorType adaptor, String provider, String externalMatchId, String fileName) {
    }

    public record Match(
            UUID matchId, LocalDate date, LocalTime startTime, String venue, String competition,
            ImportExactness exactness) {
    }

    public record Team(String key, String name, String shortName, ImportExactness exactness) {
    }

    public record Toss(String wonBy, TossDecision decision, ImportExactness exactness) {
    }

    public record Margin(ResultMarginType type, Integer value) {
    }

    public record Dls(Integer target, Integer revisedOvers) {
    }

    public record Result(
            ResultOutcomeType outcome, String winner, ResultDecidedBy decidedBy, Margin margin, Dls dls,
            Integer scheduledOvers, Integer ballsPerOver, String note, ImportExactness exactness) {

        /** The balls to an over, default 6. */
        public int ballsPerOverOrDefault() {
            return ballsPerOver == null ? 6 : ballsPerOver;
        }
    }

    public record Extras(Integer wides, Integer noBalls, Integer byes, Integer legByes, Integer penalty) {
    }

    /** {@code fallOfWickets} and {@code overByOver} are accepted and ignored; they are kept only to say so. */
    public record Innings(
            String battingTeam, InningsKind kind, Integer runs, Integer wickets, String overs, Extras extras,
            List<Batting> batting, List<String> didNotBat, List<Bowling> bowling, JsonNode fallOfWickets,
            JsonNode overByOver, ImportExactness exactness) {
    }

    public record Batting(
            String player, Integer position, DismissalType howOut, String bowler, String fielder, Integer runs,
            Integer balls, Integer fours, Integer sixes) {
    }

    public record Bowling(
            String player, String overs, Integer maidens, Integer runs, Integer wickets, Integer wides,
            Integer noBalls, Integer dots) {
    }

    public record PlayerEntry(String team, String name, Boolean substitute) {
    }

    public record PlayerOfMatch(String name, String team) {
    }

    public record Awards(PlayerOfMatch playerOfMatch, ImportExactness exactness) {
    }

    /** A copy whose {@code source} carries the adaptor and file name the server knows, keeping the input's provider. */
    public ImportedResultDto withSource(AdaptorType adaptor, String fileName) {
        Source given = source == null ? new Source(null, null, null, null) : source;
        return new ImportedResultDto(
                schemaVersion, new Source(adaptor, given.provider(), given.externalMatchId(), fileName), match, teams,
                toss, result, innings, players, awards);
    }

    /**
     * A copy with the exactness the server computed for match, teams (by key), toss and result (docs/specs/104, preview).
     * Never raises: where the document already carried a worse level that one is kept, so exactness only ever gets
     * lower. {@code toss} and {@code result} are ignored when the document has none.
     */
    public ImportedResultDto withPreviewExactness(
            ImportExactness matchLevel, java.util.Map<String, ImportExactness> teamLevels, ImportExactness tossLevel,
            ImportExactness resultLevel) {
        Match givenMatch = match == null ? new Match(null, null, null, null, null, null) : match;
        Match newMatch = new Match(
                givenMatch.matchId(), givenMatch.date(), givenMatch.startTime(), givenMatch.venue(),
                givenMatch.competition(), lower(givenMatch.exactness(), matchLevel));
        List<Team> newTeams = teams == null ? null : teams.stream()
                .map(t -> new Team(t.key(), t.name(), t.shortName(), lower(t.exactness(), teamLevels.get(t.key()))))
                .toList();
        Toss newToss = toss == null ? null : new Toss(toss.wonBy(), toss.decision(), lower(toss.exactness(), tossLevel));
        Result newResult = result == null ? null : new Result(
                result.outcome(), result.winner(), result.decidedBy(), result.margin(), result.dls(),
                result.scheduledOvers(), result.ballsPerOver(), result.note(), lower(result.exactness(), resultLevel));
        return new ImportedResultDto(schemaVersion, source, newMatch, newTeams, newToss, newResult, innings, players, awards);
    }

    private static ImportExactness lower(ImportExactness received, ImportExactness computed) {
        if (received == null) {
            return computed;
        }
        return computed == null || received.ordinal() >= computed.ordinal() ? received : computed;
    }
}
