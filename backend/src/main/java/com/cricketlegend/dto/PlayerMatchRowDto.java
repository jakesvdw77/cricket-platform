package com.cricketlegend.dto;

import com.cricketlegend.domain.DismissalType;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/115-player-match-list.md, "What a row contains": one counted match of one player. Every figure is decided by
 * {@code PlayerMatchRowBuilder}; the client only formats. A block's figures are present only for the status that has
 * them ({@code BATTED}, {@code BOWLED}, {@code RECORDED}) and are {@code null} otherwise, so a missing card is never a
 * zero. Optional figures (balls, fours, sixes, dots, wides, no-balls) are {@code null} when not recorded.
 *
 * @param matchDate the match's date and time as an instant; the client formats the date
 * @param ourTeams the club team(s) the player played for: one normally, two in a derby when on both sides
 * @param opponentName the opposition's name, {@code null} for a derby
 * @param competition {@code LEAGUE}, or {@code FRIENDLY} when the match has no league
 * @param hasBattingCard whether a batting card was captured on a side the player appears on
 * @param hasBowlingCard whether a bowling card was captured against a side the player appears on
 */
public record PlayerMatchRowDto(
        UUID matchId,
        UUID resultId,
        Instant matchDate,
        List<PlayerMatchTeam> ourTeams,
        String opponentName,
        boolean derby,
        UUID leagueId,
        String leagueName,
        String competition,
        PlayerMatchResult result,
        int ballsPerOver,
        boolean hasBattingCard,
        boolean hasBowlingCard,
        PlayerMatchBatting batting,
        PlayerMatchBowling bowling,
        PlayerMatchFielding fielding,
        PlayerMatchAwards awards) {

    /** The result from the player's side; a derby is always {@code INTERNAL}. */
    public enum PlayerMatchResult {
        WON,
        LOST,
        TIED,
        DRAWN,
        NO_RESULT,
        ABANDONED,
        INTERNAL
    }

    public enum PlayerMatchBattingStatus {
        NO_CARD,
        DID_NOT_BAT,
        BATTED
    }

    public enum PlayerMatchBowlingStatus {
        NO_CARD,
        DID_NOT_BOWL,
        BOWLED
    }

    public enum PlayerMatchFieldingStatus {
        NO_CARD,
        RECORDED
    }

    /** {@code side} is {@code HOME} or {@code AWAY}; {@code teamId} is null when the side is a free-text name. */
    public record PlayerMatchTeam(String side, UUID teamId, String teamName) {
    }

    /**
     * Figures present only when {@code status = BATTED}. {@code ballsFaced} sums only valid balls (null when none was
     * recorded); {@code fours} and {@code sixes} sum recorded values only (null when none was recorded).
     */
    public record PlayerMatchBatting(
            PlayerMatchBattingStatus status,
            List<PlayerMatchInnings> innings,
            Integer inningsCount,
            Long runs,
            Long ballsFaced,
            Long fours,
            Long sixes) {
    }

    /** One counted batting row. {@code balls} is null when not recorded or a 0-ball innings that scored runs. */
    public record PlayerMatchInnings(
            Integer runs, Integer balls, boolean notOut, DismissalType howOut, Integer fours, Integer sixes) {
    }

    /** Figures present only when {@code status = BOWLED}; {@code dots} is null when none was recorded. */
    public record PlayerMatchBowling(
            PlayerMatchBowlingStatus status,
            List<PlayerMatchSpell> spells,
            Long balls,
            Long maidens,
            Long runs,
            Long wickets,
            Long dots) {
    }

    /** One counted bowling row (the player bowled a ball or conceded a run); wickets as stored. */
    public record PlayerMatchSpell(
            int balls, int maidens, int runs, int wickets, Integer dots, Integer wides, Integer noBalls) {
    }

    /** Credits present only when {@code status = RECORDED}. */
    public record PlayerMatchFielding(
            PlayerMatchFieldingStatus status, Long catches, Long stumpings, Long runOuts) {
    }

    /** Counts of awards won by the player in this match (0, 1, or 2 for a derby team award). */
    public record PlayerMatchAwards(int playerOfTheMatch, int teamPlayerOfTheMatch) {
    }
}
