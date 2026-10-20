package com.cricketlegend.service.support;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.PlayerMatchRowDto;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchAwards;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBatting;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBattingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBowling;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBowlingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchFielding;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchFieldingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchInnings;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchResult;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchSpell;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchTeam;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * docs/specs/115-player-match-list.md, "What a row contains": the one pure place that decides what a player's match row
 * holds (statuses, the result from the player's side, summed figures, the optional-column coverage rule). It takes the
 * raw facts of the counted matches in its own plain input records and returns the row DTOs in the order of the headers it
 * was given (it never sorts). No Spring, repository, entity, caller or access information, and no other person's name,
 * so a later player-facing route reuses it unchanged.
 */
public final class PlayerMatchRowBuilder {

    private PlayerMatchRowBuilder() {}

    /**
     * One counted match of the player. {@code onHome}/{@code onAway} say which side(s) the player appears on (both in
     * a derby); {@code opponentName} is the opposite side's name. {@code hasBattingCard}/{@code hasBowlingCard} are the
     * card-captured flags of spec 103, true when captured on either side the player appears on.
     */
    public record MatchHeader(
            UUID resultId,
            UUID matchId,
            Instant matchDate,
            int ballsPerOver,
            ResultOutcomeType outcome,
            ResultSide winningSide,
            boolean derby,
            boolean onHome,
            boolean onAway,
            UUID leagueId,
            String leagueName,
            UUID homeTeamId,
            String homeTeamName,
            UUID awayTeamId,
            String awayTeamName,
            String opponentName,
            boolean hasBattingCard,
            boolean hasBowlingCard) {
    }

    /** A counted batting row. {@code balls} is already null when not valid (spec 103 "valid balls"). */
    public record BattingFact(
            UUID resultId, Integer runs, Integer balls, Integer fours, Integer sixes, DismissalType howOut) {
    }

    /** A stored bowling row of the player, whether or not it counts as a spell. */
    public record BowlingFact(
            UUID resultId, int balls, int maidens, int runs, int wickets, Integer dots, Integer wides, Integer noBalls) {
    }

    /** The player's stored fielding credits in one match, already summed over the match's innings. */
    public record FieldingFact(UUID resultId, long catches, long stumpings, long runOuts) {
    }

    /** The awards won by the player's counted appearances in one match. */
    public record AwardFact(UUID resultId, long playerOfTheMatch, long teamPlayerOfTheMatch) {
    }

    /** One row per header, in the headers' order. The fact lists may hold rows of matches not in {@code headers}. */
    public static List<PlayerMatchRowDto> build(
            List<MatchHeader> headers,
            Collection<BattingFact> batting,
            Collection<BowlingFact> bowling,
            Collection<FieldingFact> fielding,
            Collection<AwardFact> awards) {
        var battingBy = batting.stream().collect(Collectors.groupingBy(BattingFact::resultId));
        var bowlingBy = bowling.stream().collect(Collectors.groupingBy(BowlingFact::resultId));
        var fieldingBy = fielding.stream().collect(Collectors.groupingBy(FieldingFact::resultId));
        var awardsBy = awards.stream().collect(Collectors.groupingBy(AwardFact::resultId));
        List<PlayerMatchRowDto> rows = new ArrayList<>(headers.size());
        for (MatchHeader header : headers) {
            rows.add(row(
                    header,
                    battingBy.getOrDefault(header.resultId(), List.of()),
                    bowlingBy.getOrDefault(header.resultId(), List.of()),
                    fieldingBy.getOrDefault(header.resultId(), List.of()),
                    awardsBy.getOrDefault(header.resultId(), List.of())));
        }
        return rows;
    }

    /** One row from the facts of exactly this match. */
    public static PlayerMatchRowDto row(
            MatchHeader header,
            List<BattingFact> batting,
            List<BowlingFact> bowling,
            List<FieldingFact> fielding,
            List<AwardFact> awards) {
        boolean anyCard = header.hasBattingCard() || header.hasBowlingCard();
        return new PlayerMatchRowDto(
                header.matchId(),
                header.resultId(),
                header.matchDate(),
                ourTeams(header),
                header.derby() ? null : header.opponentName(),
                header.derby(),
                header.leagueId(),
                header.leagueName(),
                header.leagueId() == null ? "FRIENDLY" : "LEAGUE",
                result(header),
                header.ballsPerOver(),
                header.hasBattingCard(),
                header.hasBowlingCard(),
                batting(header, batting),
                bowling(header, bowling),
                fielding(anyCard || !fielding.isEmpty(), fielding),
                new PlayerMatchAwards(
                        (int) awards.stream().mapToLong(AwardFact::playerOfTheMatch).sum(),
                        (int) awards.stream().mapToLong(AwardFact::teamPlayerOfTheMatch).sum()));
    }

    private static List<PlayerMatchTeam> ourTeams(MatchHeader header) {
        List<PlayerMatchTeam> teams = new ArrayList<>(2);
        if (header.onHome()) {
            teams.add(new PlayerMatchTeam(ResultSide.HOME.name(), header.homeTeamId(), header.homeTeamName()));
        }
        if (header.onAway()) {
            teams.add(new PlayerMatchTeam(ResultSide.AWAY.name(), header.awayTeamId(), header.awayTeamName()));
        }
        return teams;
    }

    /** The result from the player's side (spec 115 table); a derby is Internal whatever the outcome. */
    static PlayerMatchResult result(MatchHeader header) {
        if (header.derby()) {
            return PlayerMatchResult.INTERNAL;
        }
        ResultSide side = header.onHome() ? ResultSide.HOME : ResultSide.AWAY;
        return switch (header.outcome()) {
            case WON -> header.winningSide() == side ? PlayerMatchResult.WON : PlayerMatchResult.LOST;
            case TIE -> PlayerMatchResult.TIED;
            case DRAW -> PlayerMatchResult.DRAWN;
            case NO_RESULT -> PlayerMatchResult.NO_RESULT;
            case ABANDONED -> PlayerMatchResult.ABANDONED;
            // never counted (spec 103 decision 17); not reachable from the counted-appearance query
            case FORFEIT -> throw new IllegalStateException("A forfeit is never a counted match.");
        };
    }

    private static PlayerMatchBatting batting(MatchHeader header, List<BattingFact> facts) {
        if (facts.isEmpty()) {
            PlayerMatchBattingStatus status =
                    header.hasBattingCard() ? PlayerMatchBattingStatus.DID_NOT_BAT : PlayerMatchBattingStatus.NO_CARD;
            return new PlayerMatchBatting(status, null, null, null, null, null, null);
        }
        List<PlayerMatchInnings> innings = facts.stream()
                .map(f -> new PlayerMatchInnings(
                        f.runs(),
                        f.balls(),
                        f.howOut() != null && !f.howOut().isWicket() && f.howOut().batted(),
                        f.howOut(),
                        f.fours(),
                        f.sixes()))
                .toList();
        return new PlayerMatchBatting(
                PlayerMatchBattingStatus.BATTED,
                innings,
                innings.size(),
                sum(facts, BattingFact::runs, true),
                sum(facts, BattingFact::balls, false),
                sum(facts, BattingFact::fours, false),
                sum(facts, BattingFact::sixes, false));
    }

    private static PlayerMatchBowling bowling(MatchHeader header, List<BowlingFact> facts) {
        List<PlayerMatchSpell> spells = facts.stream()
                .filter(f -> f.balls() > 0 || f.runs() > 0)
                .map(f -> new PlayerMatchSpell(
                        f.balls(), f.maidens(), f.runs(), f.wickets(), f.dots(), f.wides(), f.noBalls()))
                .toList();
        if (spells.isEmpty()) {
            PlayerMatchBowlingStatus status =
                    header.hasBowlingCard() ? PlayerMatchBowlingStatus.DID_NOT_BOWL : PlayerMatchBowlingStatus.NO_CARD;
            return new PlayerMatchBowling(status, null, null, null, null, null, null);
        }
        // the totals sum every stored row, as the aggregate does (a 0-ball, 0-run row still carries its stored credits)
        return new PlayerMatchBowling(
                PlayerMatchBowlingStatus.BOWLED,
                spells,
                (long) facts.stream().mapToInt(BowlingFact::balls).sum(),
                (long) facts.stream().mapToInt(BowlingFact::maidens).sum(),
                (long) facts.stream().mapToInt(BowlingFact::runs).sum(),
                (long) facts.stream().mapToInt(BowlingFact::wickets).sum(),
                sum(facts, BowlingFact::dots, false));
    }

    private static PlayerMatchFielding fielding(boolean anyCard, List<FieldingFact> facts) {
        if (!anyCard) { // a fielding row implies a captured scorecard, so a stored credit is never dropped
            return new PlayerMatchFielding(PlayerMatchFieldingStatus.NO_CARD, null, null, null);
        }
        return new PlayerMatchFielding(
                PlayerMatchFieldingStatus.RECORDED,
                facts.stream().mapToLong(FieldingFact::catches).sum(),
                facts.stream().mapToLong(FieldingFact::stumpings).sum(),
                facts.stream().mapToLong(FieldingFact::runOuts).sum());
    }

    /**
     * The sum of the recorded (non-null) values, or null when none was recorded. {@code zeroWhenNone} makes runs 0
     * instead (a batting row always has its runs on a published result).
     */
    private static <T> Long sum(List<T> facts, Function<T, Integer> value, boolean zeroWhenNone) {
        List<Integer> recorded = facts.stream().map(value).filter(v -> v != null).toList();
        if (recorded.isEmpty()) {
            return zeroWhenNone ? 0L : null;
        }
        return recorded.stream().mapToLong(Integer::longValue).sum();
    }
}
