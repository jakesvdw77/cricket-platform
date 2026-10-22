package com.cricketlegend.service.support;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.dto.DashboardWindowDto;
import com.cricketlegend.dto.PlayerDashboardDto;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardBattingInnings;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardBattingSummary;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardBowlingMatch;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardDismissal;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardEconomySummary;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardNotItemised;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardTrendPoint;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardWicketCoverage;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardWicketType;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardWicketTypes;
import com.cricketlegend.dto.PlayerMatchRowDto;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBattingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBowlingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchInnings;
import com.cricketlegend.dto.PlayerStatsDto.PlayerNotCaptured;
import com.cricketlegend.dto.PlayerStatsDto.PlayerStatsBasis;
import com.cricketlegend.dto.PlayerStatsDto.PlayerStatsScope;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * docs/specs/117-stats-dashboard.md, "Player series": the one pure place that shapes the player Dashboard. It takes the same
 * per-match facts as {@link PlayerMatchRowBuilder} (and builds its rows), the player's additive counters for the two
 * whole-scope reference figures, and the bowling rows with their credited dismissals, and calls {@link
 * PlayerStatsCalculator} for every figure: it defines none. Series are chronological (the headers are given oldest first and
 * never re-sorted). No Spring, repository, entity, caller or access information, and no other person's name.
 */
public final class PlayerDashboardSeriesBuilder {

    /** The bowler-credited types of the Wickets by type donut, in display order. */
    private static final List<DismissalType> WICKET_TYPE_ORDER = List.of(
            DismissalType.BOWLED,
            DismissalType.CAUGHT,
            DismissalType.CAUGHT_AND_BOWLED,
            DismissalType.LBW,
            DismissalType.STUMPED,
            DismissalType.HIT_WICKET);

    private PlayerDashboardSeriesBuilder() {}

    /**
     * @param headersOldestFirst the covered counted matches, at most {@link DashboardLimits#HISTORY_CAP}, oldest first
     * @param truncated whether the scope held more counted matches than were covered
     * @param counters the whole-scope counters (the reference figures: batting average and overall economy)
     */
    public static PlayerDashboardDto build(
            UUID playerId,
            PlayerStatsScope scope,
            PlayerStatsBasis basis,
            PlayerStatsCounters counters,
            List<PlayerMatchRowBuilder.MatchHeader> headersOldestFirst,
            boolean truncated,
            Collection<PlayerMatchRowBuilder.BattingFact> batting,
            Collection<PlayerMatchRowBuilder.BowlingFact> bowling,
            Collection<PlayerStatsCalculator.BowlingCredit> credits,
            List<PlayerNotCaptured> notCaptured) {
        List<PlayerMatchRowDto> rows =
                PlayerMatchRowBuilder.build(headersOldestFirst, batting, bowling, List.of(), List.of());
        Instant since = truncated && !rows.isEmpty() ? rows.get(0).matchDate() : null;

        List<InningsPoint> innings = innings(rows);
        List<PlayerDashboardBowlingMatch> bowled = bowlingMatches(rows);
        return new PlayerDashboardDto(
                playerId,
                scope,
                basis,
                new DashboardWindowDto(DashboardLimits.POINT_LIMIT, DashboardLimits.HISTORY_CAP),
                truncated,
                since,
                battingInnings(innings),
                battingSummary(innings, counters),
                dismissals(innings),
                battingTrend(innings),
                tail(bowled),
                wicketTypes(credits),
                economySummary(bowled, counters),
                notCaptured);
    }

    // ---- batting ----

    private record InningsPoint(PlayerMatchRowDto row, PlayerMatchInnings innings) {
    }

    private static List<InningsPoint> innings(List<PlayerMatchRowDto> rows) {
        List<InningsPoint> points = new ArrayList<>();
        for (PlayerMatchRowDto row : rows) {
            if (row.batting().status() == PlayerMatchBattingStatus.BATTED) {
                row.batting().innings().forEach(i -> points.add(new InningsPoint(row, i)));
            }
        }
        return points;
    }

    private static List<PlayerDashboardBattingInnings> battingInnings(List<InningsPoint> innings) {
        return tail(innings).stream()
                .map(p -> new PlayerDashboardBattingInnings(
                        p.row().matchId(),
                        p.row().resultId(),
                        p.row().matchDate(),
                        p.row().opponentName(),
                        p.row().derby(),
                        p.innings().runs(),
                        p.innings().balls(),
                        p.innings().notOut(),
                        p.innings().howOut() == null ? null : p.innings().howOut().name()))
                .toList();
    }

    private static PlayerDashboardBattingSummary battingSummary(List<InningsPoint> innings, PlayerStatsCounters counters) {
        long runs = innings.stream().mapToLong(p -> runs(p.innings())).sum();
        long notOuts = innings.stream().filter(p -> p.innings().notOut()).count();
        PlayerStatsCounters.Batting whole = counters.batting();
        return new PlayerDashboardBattingSummary(
                innings.size(),
                Math.min(innings.size(), DashboardLimits.POINT_LIMIT),
                notOuts,
                runs,
                PlayerStatsCalculator.battingAverage(whole.runs(), whole.dismissals()));
    }

    private static List<PlayerDashboardDismissal> dismissals(List<InningsPoint> innings) {
        Map<DismissalType, Long> counts =
                PlayerStatsCalculator.dismissalCounts(innings.stream().map(p -> p.innings().howOut()).toList());
        long total = counts.values().stream().mapToLong(Long::longValue).sum();
        List<PlayerDashboardDismissal> slices = new ArrayList<>();
        counts.forEach((type, count) ->
                slices.add(new PlayerDashboardDismissal(type.name(), label(type), count, PlayerStatsCalculator.percent(count, total))));
        return slices;
    }

    private static List<PlayerDashboardTrendPoint> battingTrend(List<InningsPoint> innings) {
        List<PlayerDashboardTrendPoint> points = new ArrayList<>(innings.size());
        long runs = 0;
        long dismissals = 0;
        for (InningsPoint p : innings) {
            runs += runs(p.innings());
            if (!p.innings().notOut()) {
                dismissals++;
            }
            points.add(new PlayerDashboardTrendPoint(
                    p.row().matchId(),
                    p.row().resultId(),
                    p.row().matchDate(),
                    p.row().opponentName(),
                    p.row().derby(),
                    runs,
                    dismissals,
                    PlayerStatsCalculator.battingAverage(runs, dismissals)));
        }
        return points;
    }

    private static long runs(PlayerMatchInnings innings) {
        return innings.runs() == null ? 0L : innings.runs();
    }

    // ---- bowling ----

    private static List<PlayerDashboardBowlingMatch> bowlingMatches(List<PlayerMatchRowDto> rows) {
        List<PlayerDashboardBowlingMatch> matches = new ArrayList<>();
        for (PlayerMatchRowDto row : rows) {
            if (row.bowling().status() != PlayerMatchBowlingStatus.BOWLED) {
                continue;
            }
            long balls = row.bowling().balls();
            long runs = row.bowling().runs();
            matches.add(new PlayerDashboardBowlingMatch(
                    row.matchId(),
                    row.resultId(),
                    row.matchDate(),
                    row.opponentName(),
                    row.derby(),
                    balls,
                    row.ballsPerOver(),
                    row.bowling().maidens(),
                    runs,
                    row.bowling().wickets(),
                    PlayerStatsCalculator.matchEconomy(runs, balls, row.ballsPerOver())));
        }
        return matches;
    }

    private static PlayerDashboardEconomySummary economySummary(
            List<PlayerDashboardBowlingMatch> bowled, PlayerStatsCounters counters) {
        PlayerStatsCounters.Bowling whole = counters.bowling();
        BigDecimal overall = whole.balls() > 0 ? PlayerStatsCalculator.economy(whole.runs(), whole.overs()) : null;
        List<PlayerDashboardBowlingMatch> shown = tail(bowled);
        long withEconomy = shown.stream().filter(m -> m.economy() != null).count();
        List<StatsTrend.Weighted> weighted = new ArrayList<>();
        for (PlayerDashboardBowlingMatch match : bowled) {
            if (match.economy() != null) {
                weighted.add(PlayerStatsCalculator.economyWeight(match.runs(), match.balls(), match.ballsPerOver()));
            }
        }
        StatsTrend.Hint hint = StatsTrend.of(weighted, 2, DashboardLimits.ECONOMY_FLAT_BAND);
        return new PlayerDashboardEconomySummary(
                overall,
                shown.size(),
                withEconomy,
                bowled.size(),
                shown.size(),
                hint == null ? null : hint.recent(),
                hint == null ? null : hint.earlier(),
                hint == null ? null : hint.direction().name());
    }

    private static PlayerDashboardWicketTypes wicketTypes(Collection<PlayerStatsCalculator.BowlingCredit> credits) {
        PlayerStatsCalculator.WicketSplit split = PlayerStatsCalculator.splitWickets(credits);
        List<PlayerDashboardWicketType> types = new ArrayList<>(WICKET_TYPE_ORDER.size());
        Map<DismissalType, Long> counts = new EnumMap<>(DismissalType.class);
        counts.putAll(split.types());
        for (DismissalType type : WICKET_TYPE_ORDER) {
            long count = counts.getOrDefault(type, 0L);
            types.add(new PlayerDashboardWicketType(
                    type.name(), label(type), count, PlayerStatsCalculator.percent(count, split.total())));
        }
        return new PlayerDashboardWicketTypes(
                types,
                new PlayerDashboardNotItemised(
                        split.notItemised(), PlayerStatsCalculator.percent(split.notItemised(), split.total())),
                split.total(),
                split.itemised(),
                new PlayerDashboardWicketCoverage(
                        split.itemised(), split.total(), split.inningsItemised(), split.inningsWithWickets()));
    }

    // ---- helpers ----

    /** The most recent {@link DashboardLimits#POINT_LIMIT} points of a chronological list. */
    private static <T> List<T> tail(List<T> chronological) {
        int from = Math.max(0, chronological.size() - DashboardLimits.POINT_LIMIT);
        return List.copyOf(chronological.subList(from, chronological.size()));
    }

    /** The display label of a dismissal type; {@code NOT_OUT} stands for both not-out kinds. */
    static String label(DismissalType type) {
        return switch (type) {
            case NOT_OUT, RETIRED_NOT_OUT -> "Not out";
            case DID_NOT_BAT -> "Did not bat";
            case BOWLED -> "Bowled";
            case CAUGHT -> "Caught";
            case CAUGHT_AND_BOWLED -> "Caught and bowled";
            case LBW -> "LBW";
            case STUMPED -> "Stumped";
            case RUN_OUT -> "Run out";
            case HIT_WICKET -> "Hit wicket";
            case HANDLED_BALL -> "Handled the ball";
            case OBSTRUCTING_FIELD -> "Obstructing the field";
            case HIT_BALL_TWICE -> "Hit the ball twice";
            case TIMED_OUT -> "Timed out";
            case RETIRED_OUT -> "Retired out";
        };
    }
}
