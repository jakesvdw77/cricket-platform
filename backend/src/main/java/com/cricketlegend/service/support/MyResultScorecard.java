package com.cricketlegend.service.support;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.BattingEntryDto;
import com.cricketlegend.dto.BowlingEntryDto;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.MyResultDto;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardDto;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * docs/specs/145: shapes a published scorecard into the Player Hub's innings cards. Pure: it decides no figure (every
 * number is a stored one), takes names in full (Decision 7: juniors included), drops every internal id (result player,
 * entry, profile) and marks the held player with {@code mine}. Carries no access information.
 */
public final class MyResultScorecard {

    private MyResultScorecard() {}

    /** The regular innings of {@code result} in sequence order, each with its batting card, did-not-bat and bowling. */
    public static List<MyResultDto.Innings> innings(
            MatchResultDto result, ScorecardDto scorecard, UUID heldProfileId, String homeName, String awayName) {
        Map<String, ResultPlayerDto> players = new HashMap<>();
        scorecard.players().forEach(p -> {
            if (p.id() != null) {
                players.put(p.id().toString(), p);
            }
        });
        return result.innings().stream()
                .filter(i -> i.kind() == InningsKind.REGULAR)
                .sorted(Comparator.comparing(i -> i.sequence() == null ? 0 : i.sequence()))
                .map(i -> oneInnings(i, result.ballsPerOver(), scorecard, players, heldProfileId, homeName, awayName))
                .toList();
    }

    private static MyResultDto.Innings oneInnings(
            InningsDto innings,
            int ballsPerOver,
            ScorecardDto scorecard,
            Map<String, ResultPlayerDto> players,
            UUID heldProfileId,
            String homeName,
            String awayName) {
        ResultSide side = innings.battingSide();
        List<BattingEntryDto> entries = scorecard.batting().stream()
                .filter(e -> e.battingSide() == side && e.inningsKind() != InningsKind.SUPER_OVER)
                .sorted(Comparator.comparing(BattingEntryDto::position, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<MyResultDto.Batter> batting = entries.stream()
                .filter(e -> e.howOut() != DismissalType.DID_NOT_BAT)
                .map(e -> {
                    ResultPlayerDto player = playerOf(players, e.resultPlayerId());
                    return new MyResultDto.Batter(
                            nameOf(player),
                            isHeld(player, heldProfileId),
                            e.position(),
                            e.howOut(),
                            nameOf(players.get(e.bowlerPlayerId())),
                            nameOf(players.get(e.fielderPlayerId())),
                            e.runs(),
                            e.balls(),
                            e.fours(),
                            e.sixes());
                })
                .toList();
        List<String> didNotBat = entries.stream()
                .filter(e -> e.howOut() == DismissalType.DID_NOT_BAT)
                .map(e -> nameOf(playerOf(players, e.resultPlayerId())))
                .filter(Objects::nonNull)
                .toList();
        List<MyResultDto.Bowler> bowling = scorecard.bowling().stream()
                .filter(e -> e.battingSide() == side && e.inningsKind() != InningsKind.SUPER_OVER)
                .sorted(Comparator.comparing(BowlingEntryDto::bowlingOrder, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(e -> {
                    ResultPlayerDto player = playerOf(players, e.resultPlayerId());
                    return new MyResultDto.Bowler(
                            nameOf(player),
                            isHeld(player, heldProfileId),
                            OversFormat.display(e.balls(), ballsPerOver),
                            e.maidens(),
                            e.runs(),
                            e.wickets(),
                            e.wides(),
                            e.noBalls(),
                            e.dots());
                })
                .toList();
        return new MyResultDto.Innings(
                innings.sequence() == null ? 0 : innings.sequence(),
                side,
                side == ResultSide.HOME ? homeName : awayName,
                innings.runs(),
                innings.wickets(),
                innings.oversDisplay(),
                innings.extras(),
                innings.wides(),
                innings.noBalls(),
                innings.byes(),
                innings.legByes(),
                innings.penaltyRuns(),
                batting,
                didNotBat,
                bowling);
    }

    /** The official and team players of the match, with the name in full. */
    public static List<MyResultDto.Award> awards(ScorecardDto scorecard) {
        return scorecard.awards().stream()
                .filter(a -> a.playerName() != null && !a.playerName().isBlank())
                .map(a -> new MyResultDto.Award(a.awardType(), a.side(), a.playerName()))
                .toList();
    }

    private static ResultPlayerDto playerOf(Map<String, ResultPlayerDto> players, UUID id) {
        return id == null ? null : players.get(id.toString());
    }

    private static boolean isHeld(ResultPlayerDto player, UUID heldProfileId) {
        return player != null && player.playerProfileId() != null && player.playerProfileId().equals(heldProfileId);
    }

    /** A linked player's first and last name, else the typed display name (guest or opposition); null when unknown. */
    private static String nameOf(ResultPlayerDto player) {
        if (player == null) {
            return null;
        }
        String full = PlayerDisplayName.of(player.firstName(), player.lastName(), false);
        if (!full.isEmpty()) {
            return full;
        }
        return player.displayName() == null || player.displayName().isBlank() ? null : player.displayName().trim();
    }
}
