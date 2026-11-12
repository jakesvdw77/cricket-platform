package com.cricketlegend.service.support;

import com.cricketlegend.dto.AwardsViewDto;
import com.cricketlegend.dto.LeaderboardTableDto;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardCell;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardTableRow;
import com.cricketlegend.dto.MyLeaderboardAwardsDto;
import com.cricketlegend.dto.MyLeaderboardStandingDto;
import com.cricketlegend.dto.MyLeaderboardStandingDto.MyStandingLine;
import com.cricketlegend.dto.MyLeaderboardStandingDto.MyStandingMinimum;
import com.cricketlegend.dto.MyLeaderboardStandingDto.MyStandingSample;
import com.cricketlegend.dto.MyLeaderboardTableDto;
import com.cricketlegend.dto.MyLeaderboardTableDto.MyLeaderboardColumn;
import com.cricketlegend.dto.MyLeaderboardTableDto.MyLeaderboardMe;
import com.cricketlegend.dto.MyLeaderboardTableDto.MyLeaderboardRow;
import com.cricketlegend.dto.MyLeaderboardTableDto.MyLeaderboardScope;
import com.cricketlegend.dto.MyStatsDto;
import com.cricketlegend.service.support.LeaderboardBoard.Group;
import com.cricketlegend.service.support.LeaderboardRanker.Candidate;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * docs/specs/147, slice 4: the one pure place that shapes the Player Hub leaderboard payloads (table with the held
 * player's row, "Where Sam stands", awards, and the standing and team-fielding blocks of My stats). It defines no figure
 * and no order: every value is the {@link PlayerStatsCalculator} figure of a {@link Candidate} (through {@link
 * LeaderboardColumn}) and every rank comes from {@link LeaderboardRanker} / {@link LeaderboardTableRanker}. Its own work
 * is shaping: dropping player ids, marking the held player's row, attaching the {@code more} flags. No Spring,
 * repository, entity, caller or access information.
 */
public final class MyLeaderboardBuilder {

    private MyLeaderboardBuilder() {}

    // ---- standings table ----

    public static MyLeaderboardTableDto table(HeldLeaderboardTable held, UUID playerId) {
        LeaderboardTableDto t = held.table();
        Group group = Group.valueOf(t.group().toUpperCase(Locale.ROOT));
        List<MyLeaderboardColumn> columns = t.columns().stream()
                .map(c -> new MyLeaderboardColumn(
                        c.code(),
                        c.label(),
                        c.longLabel(),
                        c.sortable(),
                        c.direction(),
                        c.minimumKind(),
                        LeaderboardColumn.byCode(group, c.code()).map(HubLeaderboardColumns::isMore).orElse(false)))
                .toList();
        MyLeaderboardMe me = held.me() == null
                ? null
                : new MyLeaderboardMe(held.position(), held.position() / t.page().size(), row(held.me(), playerId));
        return new MyLeaderboardTableDto(
                t.group(),
                columns,
                t.sort(),
                new MyLeaderboardScope(t.scope().seasonId(), t.scope().leagueId(), t.scope().teamId()),
                t.minimum(),
                t.basis(),
                t.page(),
                t.rows().stream().map(r -> row(r, playerId)).toList(),
                me);
    }

    private static MyLeaderboardRow row(LeaderboardTableRow r, UUID playerId) {
        return new MyLeaderboardRow(
                r.rank(), playerId.equals(r.playerId()), r.firstName(), r.lastName(), r.teamName(), r.smallSample(), r.values());
    }

    // ---- "Where Sam stands" ----

    private record LineDef(String key, String group, LeaderboardBoard board, LeaderboardColumn column) {

        String label() {
            return column.getLongLabel();
        }

        LeaderboardCell value(Candidate c) {
            return column.cell(c);
        }
    }

    private static final List<LineDef> LINES = List.of(
            new LineDef("runs", "batting", LeaderboardBoard.MOST_RUNS, LeaderboardColumn.BAT_RUNS),
            new LineDef("average", "batting", LeaderboardBoard.BATTING_AVERAGE, LeaderboardColumn.BAT_AVERAGE),
            new LineDef("strikeRate", "batting", LeaderboardBoard.STRIKE_RATE, LeaderboardColumn.BAT_STRIKE_RATE),
            new LineDef("fours", "batting", LeaderboardBoard.MOST_FOURS, LeaderboardColumn.BAT_FOURS),
            new LineDef("sixes", "batting", LeaderboardBoard.MOST_SIXES, LeaderboardColumn.BAT_SIXES),
            new LineDef("wickets", "bowling", LeaderboardBoard.MOST_WICKETS, LeaderboardColumn.BOWL_WICKETS),
            new LineDef("economy", "bowling", LeaderboardBoard.ECONOMY_RATE, LeaderboardColumn.BOWL_ECONOMY),
            new LineDef("catches", "fielding", LeaderboardBoard.MOST_CATCHES, LeaderboardColumn.FIELD_CATCHES));

    /** The held player's place in the eight headline figures among everyone loaded (the reach, in the Player Hub scope). */
    public static MyLeaderboardStandingDto standing(
            LeaderboardPlayers loaded, UUID playerId, String playerFirstName, MyLeaderboardScope scope) {
        LeaderboardQualification.Defaults defaults =
                LeaderboardQualification.defaultsForScope(loaded.candidates().stream().map(Candidate::counters).toList());
        Candidate mine = candidate(loaded, playerId);
        List<MyStandingLine> lines = LINES.stream().map(def -> line(def, loaded, mine, defaults)).toList();
        return new MyLeaderboardStandingDto(scope, playerFirstName, loaded.resultsCounted(), loaded.candidates().size(), lines);
    }

    private static MyStandingLine line(
            LineDef def, LeaderboardPlayers loaded, Candidate mine, LeaderboardQualification.Defaults defaults) {
        LeaderboardBoard board = def.board();
        Integer minimum = LeaderboardQualification.suggestedFor(board, defaults);
        LeaderboardRanker.Ranking ranking = LeaderboardRanker.rank(board, loaded.candidates(), minimum, defaults, Map.of());
        Integer rank = mine == null ? null : rankOf(ranking, mine.playerId());
        boolean below = false;
        if (minimum != null && mine != null && rank == null && !listed(ranking, mine.playerId())) {
            // listed without the minimum but removed by it
            below = listed(LeaderboardRanker.rank(board, loaded.candidates(), null, defaults, Map.of()), mine.playerId());
        }
        return new MyStandingLine(
                def.key(),
                def.group(),
                def.label(),
                rank,
                ranking.listed(),
                ranking.ranked(),
                mine == null ? null : def.value(mine),
                mine == null ? null : sample(def, mine),
                minimum == null ? null : new MyStandingMinimum(board.getMinimumKind().name(), minimum),
                below);
    }

    private static MyStandingSample sample(LineDef def, Candidate c) {
        var batting = c.figures().batting();
        var bowling = c.figures().bowling();
        long matches = c.counters().matches();
        return switch (def.group()) {
            case "batting" -> new MyStandingSample(matches, batting.innings(), batting.ballsFaced(), null, null, null);
            case "bowling" -> {
                Integer ballsPerOver = !bowling.mixedOverLengths() && bowling.ballsPerOver().size() == 1
                        ? bowling.ballsPerOver().get(0)
                        : null;
                BigDecimal overs = bowling.mixedOverLengths()
                        ? null
                        : LeaderboardRanker.overs(c).setScale(2, RoundingMode.HALF_UP);
                yield new MyStandingSample(matches, bowling.inningsBowled(), null, bowling.ballsBowled(), overs, ballsPerOver);
            }
            default -> new MyStandingSample(matches, null, null, null, null, null);
        };
    }

    // ---- My stats blocks ----

    /**
     * The held player's rank by batting average among the batters loaded (a league), under the filter-aware default minimum
     * of innings. Null when the player has no batting innings there; the rank is null while the player is below the minimum
     * or has no average yet.
     */
    public static MyStatsDto.MyStatsStanding leagueBattingStanding(LeaderboardPlayers loaded, UUID playerId) {
        Candidate mine = candidate(loaded, playerId);
        if (mine == null || mine.figures().batting().innings() < 1) {
            return null;
        }
        LeaderboardQualification.Defaults defaults =
                LeaderboardQualification.defaultsForScope(loaded.candidates().stream().map(Candidate::counters).toList());
        LeaderboardRanker.Ranking ranking = LeaderboardRanker.rank(
                LeaderboardBoard.BATTING_AVERAGE, loaded.candidates(), defaults.innings(), defaults, Map.of());
        return new MyStatsDto.MyStatsStanding(
                rankOf(ranking, playerId),
                ranking.ranked(),
                mine.figures().batting().average(),
                mine.figures().batting().innings());
    }

    /** Catches, run-outs and stumpings of everyone loaded (the player's team(s) in the scope), as stored credits. */
    public static MyStatsDto.MyStatsTeamFielding teamFielding(LeaderboardPlayers loaded) {
        long catches = 0;
        long runOuts = 0;
        long stumpings = 0;
        for (Candidate c : loaded.candidates()) {
            catches += c.figures().fielding().catches();
            runOuts += c.figures().fielding().runOuts();
            stumpings += c.figures().fielding().stumpings();
        }
        return new MyStatsDto.MyStatsTeamFielding(catches, runOuts, stumpings);
    }

    /** The held player's rank for catches among everyone loaded; null when the player has no catch. */
    public static Integer teamFieldingRank(LeaderboardPlayers loaded, UUID playerId) {
        LeaderboardQualification.Defaults defaults =
                LeaderboardQualification.defaultsForScope(loaded.candidates().stream().map(Candidate::counters).toList());
        return rankOf(
                LeaderboardRanker.rank(LeaderboardBoard.MOST_CATCHES, loaded.candidates(), null, defaults, Map.of()), playerId);
    }

    // ---- awards ----

    public static MyLeaderboardAwardsDto awards(AwardsViewDto awards, UUID playerId, MyLeaderboardScope scope) {
        return new MyLeaderboardAwardsDto(
                scope,
                true,
                null,
                null,
                null,
                awards.basis(),
                awards.minimums(),
                awards.categories().stream()
                        .map(c -> new MyLeaderboardAwardsDto.MyAwardsCategory(
                                c.board(), c.leaders().stream().map(l -> leader(l, playerId)).toList()))
                        .toList(),
                awards.omitted());
    }

    /** Awards held back: no leaders, only the reason, the sentence and the day the season ends (when one applies). */
    public static MyLeaderboardAwardsDto awardsHeldBack(
            MyLeaderboardScope scope, String reason, String message, LocalDate seasonEndDate) {
        return new MyLeaderboardAwardsDto(scope, false, reason, message, seasonEndDate, null, null, List.of(), List.of());
    }

    private static MyLeaderboardAwardsDto.MyAwardsLeader leader(AwardsViewDto.LeaderboardRow l, UUID playerId) {
        return new MyLeaderboardAwardsDto.MyAwardsLeader(
                l.rank(),
                playerId.equals(l.playerId()),
                l.firstName(),
                l.lastName(),
                l.figure(),
                l.matches(),
                l.innings(),
                l.sample(),
                l.smallSample(),
                l.detail());
    }

    // ---- helpers ----

    private static Candidate candidate(LeaderboardPlayers loaded, UUID playerId) {
        return loaded.candidates().stream().filter(c -> c.playerId().equals(playerId)).findFirst().orElse(null);
    }

    private static Integer rankOf(LeaderboardRanker.Ranking ranking, UUID playerId) {
        return ranking.rows().stream()
                .filter(r -> r.playerId().equals(playerId))
                .map(AwardsViewDto.LeaderboardRow::rank)
                .findFirst()
                .orElse(null);
    }

    private static boolean listed(LeaderboardRanker.Ranking ranking, UUID playerId) {
        return ranking.rows().stream().anyMatch(r -> r.playerId().equals(playerId));
    }
}
