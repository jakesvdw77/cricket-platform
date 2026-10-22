package com.cricketlegend.service.support;

import com.cricketlegend.dto.DashboardWindowDto;
import com.cricketlegend.dto.TeamDashboardDto;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardDotBallsPoint;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardDotBallsSummary;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardExtrasPoint;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardExtrasSummary;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardNetRunRatePoint;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardNetRunRateTrend;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardResult;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardResultsSummary;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardRunRatePoint;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsNotCaptured;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsPageBasis;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsPageScope;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/117-stats-dashboard.md, "Team series": the one pure place that shapes the team Dashboard from the per-result
 * counters of {@code TeamStatsSql.DASHBOARD_RESULTS}. Every figure (the result letter, a run rate, a running net run rate, a
 * dot percentage, an extras total, a trend hint) is {@link TeamStatsCalculator}'s or {@link StatsTrend}'s; this class only
 * orders, windows and counts. Series are chronological (the facts are given oldest first and never re-sorted). A forfeit
 * appears in the results only, with its letter and no figures. No Spring, repository, entity, caller or access
 * information, and no person's name.
 */
public final class TeamDashboardSeriesBuilder {

    /**
     * The counters of one counted team result. A figure is null when no usable innings fed it. {@code bowlRows} and {@code
     * bowlDotsRows}: our bowler rows that bowled a ball, and those of them that recorded dots. {@code nrr*}: the inputs of
     * the Net Run Rate when {@code nrrUsable}.
     */
    public record ResultFact(
            UUID resultId,
            UUID matchId,
            Instant matchDate,
            String opponentName,
            boolean derby,
            String outcome,
            String winningSide,
            String side,
            long oppInnings,
            long ownUsable,
            long oppUsable,
            Long ownRuns,
            Long ownWickets,
            Long ownBalls,
            Long ownRunsWithBalls,
            BigDecimal ownOvers,
            Long oppRuns,
            Long oppWickets,
            Long oppBalls,
            Long oppRunsWithBalls,
            BigDecimal oppOvers,
            Long extras,
            Long wides,
            Long noBalls,
            Long byes,
            Long legByes,
            Long penaltyRuns,
            Long bowlBalls,
            Long bowlDots,
            long bowlRows,
            long bowlDotsRows,
            boolean nrrUsable,
            long nrrOwnRuns,
            long nrrOppRuns,
            BigDecimal nrrOwnOvers,
            BigDecimal nrrOppOvers) {
    }

    private TeamDashboardSeriesBuilder() {}

    /**
     * @param factsOldestFirst the covered counted results, at most {@link DashboardLimits#HISTORY_CAP}, oldest first
     * @param truncated whether the scope held more counted results than were covered
     * @param nrrStatus the page's Net Run Rate status for the same scope ({@code TeamStatsCalculator})
     */
    public static TeamDashboardDto build(
            UUID teamId,
            String teamName,
            TeamStatsPageScope scope,
            TeamStatsPageBasis basis,
            TeamStatsCalculator.NrrStatus nrrStatus,
            List<ResultFact> factsOldestFirst,
            boolean truncated,
            List<TeamStatsNotCaptured> notCaptured) {
        Instant since = truncated && !factsOldestFirst.isEmpty() ? factsOldestFirst.get(0).matchDate() : null;
        List<ResultFact> withOpposition =
                factsOldestFirst.stream().filter(f -> f.oppInnings() > 0).toList();
        List<TeamDashboardResult> results = tail(factsOldestFirst).stream()
                .map(TeamDashboardSeriesBuilder::result)
                .toList();
        return new TeamDashboardDto(
                teamId,
                teamName,
                scope,
                basis,
                new DashboardWindowDto(DashboardLimits.POINT_LIMIT, DashboardLimits.HISTORY_CAP),
                truncated,
                since,
                results,
                resultsSummary(factsOldestFirst, results),
                runRateTrend(factsOldestFirst),
                netRunRateTrend(nrrStatus, factsOldestFirst),
                tail(withOpposition).stream().map(TeamDashboardSeriesBuilder::extrasPoint).toList(),
                extrasSummary(withOpposition),
                tail(withOpposition).stream().map(TeamDashboardSeriesBuilder::dotsPoint).toList(),
                dotsSummary(withOpposition),
                notCaptured);
    }

    // ---- results ----

    private static TeamStatsCalculator.FormLine line(ResultFact fact) {
        return TeamStatsCalculator.formLine(fact.outcome(), fact.winningSide(), fact.side());
    }

    private static TeamDashboardResult result(ResultFact fact) {
        TeamStatsCalculator.FormLine line = line(fact);
        boolean own = !line.forfeit() && fact.ownUsable() > 0;
        boolean opp = !line.forfeit() && fact.oppUsable() > 0;
        return new TeamDashboardResult(
                fact.matchId(),
                fact.resultId(),
                fact.matchDate(),
                fact.opponentName(),
                fact.derby(),
                line.forfeit(),
                line.result().name(),
                own ? fact.ownRuns() : null,
                own ? fact.ownWickets() : null,
                own ? fact.ownBalls() : null,
                opp ? fact.oppRuns() : null,
                opp ? fact.oppWickets() : null,
                opp ? fact.oppBalls() : null,
                own && fact.ownRuns() != null ? TeamStatsCalculator.rate(runsWithBalls(fact.ownRunsWithBalls()), fact.ownOvers()) : null,
                opp && fact.oppRuns() != null ? TeamStatsCalculator.rate(runsWithBalls(fact.oppRunsWithBalls()), fact.oppOvers()) : null);
    }

    private static TeamDashboardResultsSummary resultsSummary(List<ResultFact> all, List<TeamDashboardResult> shown) {
        long won = 0;
        long lost = 0;
        long tied = 0;
        long drawn = 0;
        long noResult = 0;
        long forfeits = 0;
        for (ResultFact fact : all) {
            TeamStatsCalculator.FormLine line = line(fact);
            forfeits += line.forfeit() ? 1 : 0;
            switch (line.result()) {
                case WON -> won++;
                case LOST -> lost++;
                case TIED -> tied++;
                case DRAWN -> drawn++;
                case NO_RESULT -> noResult++;
            }
        }
        long withRuns = shown.stream().filter(r -> r.ownRuns() != null && r.oppRuns() != null).count();
        return new TeamDashboardResultsSummary(
                all.size(), won, lost, tied, drawn, noResult, forfeits, all.size(), shown.size(), withRuns,
                PlayerStatsCalculator.percent(won, all.size()),
                PlayerStatsCalculator.percent(lost, all.size()),
                PlayerStatsCalculator.percent(tied, all.size()),
                PlayerStatsCalculator.percent(drawn, all.size()),
                PlayerStatsCalculator.percent(noResult, all.size()));
    }

    // ---- run rates ----

    private static List<TeamDashboardRunRatePoint> runRateTrend(List<ResultFact> facts) {
        List<TeamDashboardRunRatePoint> points = new ArrayList<>();
        TeamStatsCalculator.RunningRate own = new TeamStatsCalculator.RunningRate();
        TeamStatsCalculator.RunningRate opposition = new TeamStatsCalculator.RunningRate();
        for (ResultFact fact : facts) {
            boolean ownBalls = fact.ownOvers() != null && fact.ownOvers().signum() > 0;
            boolean oppBalls = fact.oppOvers() != null && fact.oppOvers().signum() > 0;
            if (!ownBalls && !oppBalls) {
                continue;
            }
            if (ownBalls) {
                own.add(fact.ownRunsWithBalls(), fact.ownOvers());
            }
            if (oppBalls) {
                opposition.add(fact.oppRunsWithBalls(), fact.oppOvers());
            }
            points.add(new TeamDashboardRunRatePoint(
                    fact.matchId(),
                    fact.resultId(),
                    fact.matchDate(),
                    fact.opponentName(),
                    own.rate(),
                    opposition.rate()));
        }
        return points;
    }

    private static TeamDashboardNetRunRateTrend netRunRateTrend(
            TeamStatsCalculator.NrrStatus status, List<ResultFact> facts) {
        List<TeamDashboardNetRunRatePoint> points = new ArrayList<>();
        if (status == TeamStatsCalculator.NrrStatus.SHOWN) {
            TeamStatsCalculator.RunningRate own = new TeamStatsCalculator.RunningRate();
            TeamStatsCalculator.RunningRate opposition = new TeamStatsCalculator.RunningRate();
            for (ResultFact fact : facts) {
                if (!fact.nrrUsable()) {
                    continue;
                }
                own.add(fact.nrrOwnRuns(), fact.nrrOwnOvers());
                opposition.add(fact.nrrOppRuns(), fact.nrrOppOvers());
                BigDecimal value = TeamStatsCalculator.runningNrr(own, opposition);
                if (value != null) {
                    points.add(new TeamDashboardNetRunRatePoint(
                            fact.matchId(), fact.resultId(), fact.matchDate(), fact.opponentName(), value));
                }
            }
        }
        return new TeamDashboardNetRunRateTrend(status.name(), points);
    }

    // ---- extras ----

    private static TeamDashboardExtrasPoint extrasPoint(ResultFact fact) {
        TeamStatsCalculator.ExtrasPoint extras = TeamStatsCalculator.extrasForMatch(
                fact.extras(), fact.wides(), fact.noBalls(), fact.byes(), fact.legByes(), fact.penaltyRuns());
        return new TeamDashboardExtrasPoint(
                fact.matchId(),
                fact.resultId(),
                fact.matchDate(),
                fact.opponentName(),
                fact.derby(),
                toInt(fact.wides()),
                toInt(fact.noBalls()),
                toInt(fact.byes()),
                toInt(fact.legByes()),
                toInt(fact.penaltyRuns()),
                extras.itemised(),
                toInt(extras.notItemised()),
                toInt(extras.total()));
    }

    private static TeamDashboardExtrasSummary extrasSummary(List<ResultFact> withOpposition) {
        List<TeamDashboardExtrasPoint> shown =
                tail(withOpposition).stream().map(TeamDashboardSeriesBuilder::extrasPoint).toList();
        return new TeamDashboardExtrasSummary(
                shown.size(),
                shown.stream().filter(p -> p.total() != null).count(),
                shown.stream().filter(TeamDashboardExtrasPoint::itemised).count(),
                withOpposition.size(),
                shown.size(),
                shown.stream().filter(p -> p.wides() != null).count(),
                shown.stream().filter(p -> p.noBalls() != null).count(),
                shown.stream().filter(p -> p.byes() != null).count(),
                shown.stream().filter(p -> p.legByes() != null).count(),
                shown.stream().filter(p -> p.penaltyRuns() != null).count());
    }

    // ---- dot balls ----

    private static TeamStatsCalculator.DotsPoint dots(ResultFact fact) {
        return TeamStatsCalculator.dotsForMatch(fact.bowlBalls(), fact.bowlDots(), fact.bowlRows(), fact.bowlDotsRows());
    }

    private static TeamDashboardDotBallsPoint dotsPoint(ResultFact fact) {
        TeamStatsCalculator.DotsPoint dots = dots(fact);
        return new TeamDashboardDotBallsPoint(
                fact.matchId(),
                fact.resultId(),
                fact.matchDate(),
                fact.opponentName(),
                fact.derby(),
                dots.ballsBowled(),
                dots.dots(),
                dots.percent());
    }

    private static TeamDashboardDotBallsSummary dotsSummary(List<ResultFact> withOpposition) {
        List<ResultFact> shown = tail(withOpposition);
        TeamStatsCalculator.DotsPool pool = new TeamStatsCalculator.DotsPool();
        shown.forEach(fact -> pool.add(dots(fact)));
        StatsTrend.Hint hint = StatsTrend.of(pool.weighted(), 1, DashboardLimits.DOT_PERCENT_FLAT_BAND);
        return new TeamDashboardDotBallsSummary(
                shown.size(),
                pool.charted(),
                withOpposition.size(),
                shown.size(),
                pool.percent(),
                hint == null ? null : hint.recent(),
                hint == null ? null : hint.earlier(),
                hint == null ? null : hint.direction().name());
    }

    // ---- helpers ----

    private static <T> List<T> tail(List<T> chronological) {
        int from = Math.max(0, chronological.size() - DashboardLimits.POINT_LIMIT);
        return List.copyOf(chronological.subList(from, chronological.size()));
    }

    private static long runsWithBalls(Long value) {
        return value == null ? 0L : value;
    }

    private static Integer toInt(Long value) {
        return value == null ? null : Math.toIntExact(value);
    }
}
