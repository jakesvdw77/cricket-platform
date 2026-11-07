package com.cricketlegend.service.support;

import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardPageInfo;
import com.cricketlegend.dto.MyStatsInningsPageDto;
import com.cricketlegend.dto.MyStatsInningsPageDto.MyStatsInningsBatting;
import com.cricketlegend.dto.MyStatsInningsPageDto.MyStatsInningsBowling;
import com.cricketlegend.dto.MyStatsInningsPageDto.MyStatsInningsFielding;
import com.cricketlegend.dto.MyStatsInningsPageDto.MyStatsInningsRow;
import com.cricketlegend.dto.PlayerMatchRowDto;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBattingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBowlingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchFieldingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchInnings;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchSpell;
import com.cricketlegend.exception.ValidationException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * docs/specs/147, the match drill: lists the innings, spells or matches behind a figure from the held player's history,
 * newest first, keeps those the {@link StatsDrillFilter} keeps and cuts one page. Every figure on a row is a stored value or
 * a {@link PlayerStatsCalculator} result. Pure: no Spring, repository, entity, caller or access information.
 */
public final class MyStatsDrill {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    private MyStatsDrill() {}

    /** The 400 for a bad page or size, as the match list (spec 115): never clamped. */
    public static void checkPaging(Integer page, Integer size) {
        if ((page != null && page < 0) || (size != null && (size < 1 || size > MAX_SIZE))) {
            throw new ValidationException("page must be zero or more and size between 1 and " + MAX_SIZE + ".");
        }
    }

    public static MyStatsInningsPageDto page(
            StatsDrillFilter.Kind kind,
            StatsDrillFilter.Filter filter,
            HeldPlayerHistory history,
            Integer page,
            Integer size) {
        checkPaging(page, size);
        int number = page == null ? 0 : page;
        int pageSize = size == null ? DEFAULT_SIZE : size;

        List<PlayerMatchRowDto> newestFirst = new ArrayList<>(history.rowsOldestFirst());
        Collections.reverse(newestFirst);
        List<MyStatsInningsRow> all = switch (kind) {
            case BATTING -> batting(newestFirst, history, filter);
            case BOWLING -> bowling(newestFirst, filter);
            case FIELDING -> fielding(newestFirst, filter);
            case MATCHES -> matches(newestFirst, history, filter);
        };
        long total = all.size();
        long from = (long) number * pageSize;
        List<MyStatsInningsRow> slice = from >= total
                ? List.of()
                : List.copyOf(all.subList((int) from, (int) Math.min(total, from + pageSize)));
        return new MyStatsInningsPageDto(
                kind.name(),
                filter == null ? null : filter.name(),
                kind.title(),
                filter == null ? null : filter.label(),
                history.truncated(),
                new LeaderboardPageInfo(number, pageSize, total, from + slice.size() < total),
                slice);
    }

    private static List<MyStatsInningsRow> batting(
            List<PlayerMatchRowDto> newestFirst, HeldPlayerHistory history, StatsDrillFilter.Filter filter) {
        List<PlayerStatsCalculator.InningsDetail> oldestFirst =
                PlayerStatsCalculator.joinInnings(history.rowsOldestFirst(), history.battingDetail());
        Map<UUID, PlayerMatchRowDto> byResult = byResult(newestFirst);
        List<MyStatsInningsRow> rows = new ArrayList<>();
        for (int i = oldestFirst.size() - 1; i >= 0; i--) {
            PlayerStatsCalculator.InningsDetail d = oldestFirst.get(i);
            if (!StatsDrillFilter.keeps(
                    filter, new StatsDrillFilter.BattingSubject(d.inningsSequence(), d.runs(), d.notOut(), d.howOut()))) {
                continue;
            }
            PlayerMatchRowDto row = byResult.get(d.resultId());
            rows.add(row(row, new MyStatsInningsBatting(
                            d.inningsSequence(),
                            d.runs(),
                            d.balls(),
                            d.fours(),
                            d.sixes(),
                            d.notOut(),
                            d.howOut() == null ? null : d.howOut().name(),
                            d.bowlerName(),
                            PlayerStatsCalculator.strikeRate(d.runs(), d.balls())),
                    null,
                    null));
        }
        return rows;
    }

    private static List<MyStatsInningsRow> bowling(List<PlayerMatchRowDto> newestFirst, StatsDrillFilter.Filter filter) {
        List<MyStatsInningsRow> rows = new ArrayList<>();
        for (PlayerMatchRowDto row : newestFirst) {
            if (row.bowling().status() != PlayerMatchBowlingStatus.BOWLED || row.bowling().spells() == null) {
                continue;
            }
            List<PlayerMatchSpell> spells = new ArrayList<>(row.bowling().spells());
            Collections.reverse(spells);
            for (PlayerMatchSpell spell : spells) {
                if (StatsDrillFilter.keeps(filter, new StatsDrillFilter.BowlingSubject(spell.wickets()))) {
                    rows.add(row(row, null, bowlingFigures(spell, row.ballsPerOver()), null));
                }
            }
        }
        return rows;
    }

    private static List<MyStatsInningsRow> fielding(List<PlayerMatchRowDto> newestFirst, StatsDrillFilter.Filter filter) {
        List<MyStatsInningsRow> rows = new ArrayList<>();
        for (PlayerMatchRowDto row : newestFirst) {
            if (row.fielding().status() != PlayerMatchFieldingStatus.RECORDED) {
                continue;
            }
            long catches = row.fielding().catches() == null ? 0L : row.fielding().catches();
            long stumpings = row.fielding().stumpings() == null ? 0L : row.fielding().stumpings();
            long runOuts = row.fielding().runOuts() == null ? 0L : row.fielding().runOuts();
            if (StatsDrillFilter.keeps(filter, new StatsDrillFilter.FieldingSubject(catches, stumpings, runOuts))) {
                rows.add(row(row, null, null, new MyStatsInningsFielding(catches, stumpings, runOuts)));
            }
        }
        return rows;
    }

    private static List<MyStatsInningsRow> matches(
            List<PlayerMatchRowDto> newestFirst, HeldPlayerHistory history, StatsDrillFilter.Filter filter) {
        Map<UUID, Integer> best = new HashMap<>();
        for (PlayerStatsCalculator.RawBattingDetail d : history.battingDetail()) {
            if (d.runs() != null) {
                best.merge(d.resultId(), d.runs(), Math::max);
            }
        }
        List<MyStatsInningsRow> rows = new ArrayList<>();
        for (PlayerMatchRowDto row : newestFirst) {
            if (!StatsDrillFilter.keeps(filter, new StatsDrillFilter.MatchSubject(best.get(row.resultId()), row.hasBattingCard()))) {
                continue;
            }
            rows.add(row(row, matchBatting(row), matchBowling(row), matchFielding(row)));
        }
        return rows;
    }

    private static MyStatsInningsBatting matchBatting(PlayerMatchRowDto row) {
        if (row.batting().status() != PlayerMatchBattingStatus.BATTED) {
            return null;
        }
        List<PlayerMatchInnings> innings = row.batting().innings();
        PlayerMatchInnings last = innings.get(innings.size() - 1);
        Integer runs = row.batting().runs() == null ? null : Math.toIntExact(row.batting().runs());
        Integer balls = row.batting().ballsFaced() == null ? null : Math.toIntExact(row.batting().ballsFaced());
        return new MyStatsInningsBatting(
                null,
                runs,
                balls,
                row.batting().fours() == null ? null : Math.toIntExact(row.batting().fours()),
                row.batting().sixes() == null ? null : Math.toIntExact(row.batting().sixes()),
                last.notOut(),
                last.howOut() == null ? null : last.howOut().name(),
                null,
                PlayerStatsCalculator.strikeRate(runs, balls));
    }

    private static MyStatsInningsBowling matchBowling(PlayerMatchRowDto row) {
        if (row.bowling().status() != PlayerMatchBowlingStatus.BOWLED) {
            return null;
        }
        return new MyStatsInningsBowling(
                row.bowling().balls(),
                row.ballsPerOver(),
                row.bowling().maidens(),
                row.bowling().runs(),
                row.bowling().wickets(),
                PlayerStatsCalculator.matchEconomy(row.bowling().runs(), row.bowling().balls(), row.ballsPerOver()),
                null,
                null,
                row.bowling().dots() == null ? null : Math.toIntExact(row.bowling().dots()));
    }

    private static MyStatsInningsFielding matchFielding(PlayerMatchRowDto row) {
        if (row.fielding().status() != PlayerMatchFieldingStatus.RECORDED) {
            return null;
        }
        return new MyStatsInningsFielding(row.fielding().catches(), row.fielding().stumpings(), row.fielding().runOuts());
    }

    private static MyStatsInningsBowling bowlingFigures(PlayerMatchSpell spell, int ballsPerOver) {
        return new MyStatsInningsBowling(
                spell.balls(),
                ballsPerOver,
                spell.maidens(),
                spell.runs(),
                spell.wickets(),
                PlayerStatsCalculator.matchEconomy(spell.runs(), spell.balls(), ballsPerOver),
                spell.wides(),
                spell.noBalls(),
                spell.dots());
    }

    private static Map<UUID, PlayerMatchRowDto> byResult(List<PlayerMatchRowDto> rows) {
        Map<UUID, PlayerMatchRowDto> map = new HashMap<>();
        rows.forEach(r -> map.put(r.resultId(), r));
        return map;
    }

    private static MyStatsInningsRow row(
            PlayerMatchRowDto row,
            MyStatsInningsBatting batting,
            MyStatsInningsBowling bowling,
            MyStatsInningsFielding fielding) {
        String team = row.ourTeams().isEmpty() ? null : row.ourTeams().get(0).teamName();
        return new MyStatsInningsRow(
                row.matchId(),
                row.matchDate(),
                row.opponentName(),
                row.derby(),
                team,
                row.result().name(),
                batting,
                bowling,
                fielding);
    }
}
