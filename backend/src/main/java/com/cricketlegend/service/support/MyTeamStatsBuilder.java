package com.cricketlegend.service.support;

import com.cricketlegend.dto.MyTeamStatsDto;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamBattingOrder;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamCloseGames;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamContribution;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamCount;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamCoverage;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamExtrasCard;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamExtrasComponent;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamExtrasSide;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamHeadToHead;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamMeeting;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamShareBlock;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamShareLine;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamSplit;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamSquad;
import com.cricketlegend.dto.MyTeamStatsDto.MyTeamToss;
import com.cricketlegend.dto.TeamDashboardDto;
import com.cricketlegend.dto.TeamStatsDto;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/147: the one pure place that assembles the Player Hub "Team stats" payload. It defines no figure: every value
 * is a field of {@link TeamStatsDto} (already the calculator's output), a Dashboard series point, or the result of a {@link
 * TeamStatsCalculator} method. Its own work is shaping (dropping internal ids, naming the blocks). No Spring, repository,
 * entity, caller or access information.
 */
public final class MyTeamStatsBuilder {

    private MyTeamStatsBuilder() {}

    /** The inputs that are not in the history: the echoed scope and the "available" count of each closed poll of the counted matches. */
    public record Extras(
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            StatsScope.Competition competition,
            Collection<Long> availableCounts) {
    }

    public static MyTeamStatsDto build(HeldTeamHistory history, TeamDashboardDto dashboard, Extras extras) {
        TeamStatsDto stats = history.stats();
        TeamStatsCalculator.Figures figures = TeamStatsCalculator.calculate(history.counters());
        List<TeamStatsCalculator.ResultFact> results = history.resultsOldestFirst();
        TeamStatsCalculator.Extent extent = history.extent();

        TeamStatsCalculator.BattingOrder order = TeamStatsCalculator.battingOrder(results);
        TeamStatsCalculator.Toss toss = TeamStatsCalculator.toss(results);
        TeamStatsCalculator.CloseGames close = TeamStatsCalculator.closeGames(results);
        TeamStatsCalculator.Squad squad = TeamStatsCalculator.squad(extent, extras.availableCounts(), order.counted());
        TeamStatsCalculator.ShareBlock runs =
                TeamStatsCalculator.runsContribution(history.contribution(), extent, figures.batting().runs());
        TeamStatsCalculator.ShareBlock wickets =
                TeamStatsCalculator.wicketsContribution(history.contribution(), extent, figures.bowling().wicketsTaken());

        TeamStatsDto.TeamStatsPageBasis basis = stats.basis();
        return new MyTeamStatsDto(
                new MyTeamStatsDto.MyTeamScope(
                        extras.seasonId(),
                        extras.leagueId(),
                        extras.teamId(),
                        extras.competition() == null ? null : extras.competition().name()),
                stats.teamName(),
                new MyTeamStatsDto.MyTeamBasis(
                        basis.resultsCounted(),
                        basis.internalResults(),
                        basis.resultsNoBallBowled(),
                        basis.forfeits(),
                        basis.resultsWithBothInnings(),
                        history.truncated(),
                        DashboardLimits.HISTORY_CAP,
                        new MyTeamCoverage(
                                new MyTeamCount(order.recorded(), order.counted()),
                                new MyTeamCount(toss.known(), toss.counted()),
                                new MyTeamCount(squad.matchesWithPoll(), squad.counted()),
                                new MyTeamCount(runs.inningsWithCard(), runs.inningsCounted()),
                                new MyTeamCount(wickets.inningsWithCard(), wickets.inningsCounted()),
                                new MyTeamCount(close.withMargin(), close.decided()))),
                stats.record(),
                stats.form().stream()
                        .map(f -> new MyTeamStatsDto.MyTeamFormEntry(
                                f.matchId(), f.matchDate(), f.opponentName(), f.derby(), f.result(), f.forfeit()))
                        .toList(),
                stats.batting(),
                stats.chasing(),
                stats.bowling(),
                stats.extras(),
                stats.netRunRate(),
                series(dashboard),
                new MyTeamContribution(share(runs), share(wickets)),
                new MyTeamBattingOrder(
                        new MyTeamSplit(order.battingFirst().played(), order.battingFirst().won()),
                        new MyTeamSplit(order.chasing().played(), order.chasing().won()),
                        order.recorded(),
                        order.counted()),
                new MyTeamToss(toss.known() == 0 ? null : toss.won(), toss.known(), toss.counted(), toss.known() < toss.counted()),
                TeamStatsCalculator.headToHead(results).stream().map(MyTeamStatsBuilder::headToHead).toList(),
                new MyTeamSquad(
                        squad.playersUsed(),
                        squad.guestAppearances(),
                        squad.averageAvailable(),
                        squad.matchesWithPoll(),
                        squad.counted(),
                        squad.matchesWithPoll() < squad.counted()),
                new MyTeamCloseGames(
                        close.played(), close.won(), close.closeRuns(), close.closeWickets(), close.decided(), close.withMargin()),
                extrasCard(TeamStatsCalculator.extrasCard(history.counters(), extent)),
                stats.notCaptured());
    }

    private static MyTeamShareBlock share(TeamStatsCalculator.ShareBlock b) {
        return new MyTeamShareBlock(
                b.total(),
                b.lines().stream()
                        .map(l -> new MyTeamShareLine(l.kind().name(), l.label(), l.value(), l.sharePercent()))
                        .toList(),
                b.inningsWithCard(),
                b.inningsCounted());
    }

    private static MyTeamHeadToHead headToHead(TeamStatsCalculator.HeadToHead h) {
        return new MyTeamHeadToHead(
                h.opponentName(),
                h.played(),
                h.won(),
                h.lost(),
                h.tied(),
                h.drawn(),
                h.noResult(),
                h.results().stream()
                        .map(r -> new MyTeamMeeting(r.matchId(), r.matchDate(), r.result().name(), r.forfeit()))
                        .toList());
    }

    private static MyTeamExtrasCard extrasCard(TeamStatsCalculator.ExtrasCard c) {
        return new MyTeamExtrasCard(side(c.gaveAway()), side(c.received()), c.partly());
    }

    private static MyTeamExtrasSide side(TeamStatsCalculator.ExtrasSide s) {
        return new MyTeamExtrasSide(
                s.total(),
                s.sharePercent(),
                component(s.wides()),
                component(s.noBalls()),
                component(s.byes()),
                component(s.legByes()),
                component(s.penaltyRuns()),
                s.inningsWithExtras(),
                s.inningsCounted());
    }

    private static MyTeamExtrasComponent component(TeamStatsCalculator.ExtrasFigure f) {
        return new MyTeamExtrasComponent(f.value(), f.inningsRecorded(), f.inningsCounted());
    }

    /** The team Dashboard series without result ids. */
    static MyTeamStatsDto.MyTeamSeries series(TeamDashboardDto d) {
        return new MyTeamStatsDto.MyTeamSeries(
                d.window(),
                d.results().stream()
                        .map(r -> new MyTeamStatsDto.MyTeamResult(
                                r.matchId(),
                                r.matchDate(),
                                r.opponentName(),
                                r.derby(),
                                r.forfeit(),
                                r.result(),
                                r.ownRuns(),
                                r.ownWickets(),
                                r.ownBalls(),
                                r.oppRuns(),
                                r.oppWickets(),
                                r.oppBalls(),
                                r.ownRunRate(),
                                r.oppRunRate()))
                        .toList(),
                d.resultsSummary(),
                d.runRateTrend().stream()
                        .map(p -> new MyTeamStatsDto.MyTeamRunRatePoint(
                                p.matchId(), p.matchDate(), p.opponentName(), p.teamRunRate(), p.oppositionRunRate()))
                        .toList(),
                new MyTeamStatsDto.MyTeamNetRunRateTrend(
                        d.netRunRateTrend().status(),
                        d.netRunRateTrend().points().stream()
                                .map(p -> new MyTeamStatsDto.MyTeamNetRunRatePoint(
                                        p.matchId(), p.matchDate(), p.opponentName(), p.value()))
                                .toList()),
                d.extrasConceded().stream()
                        .map(p -> new MyTeamStatsDto.MyTeamExtrasPoint(
                                p.matchId(),
                                p.matchDate(),
                                p.opponentName(),
                                p.derby(),
                                p.wides(),
                                p.noBalls(),
                                p.byes(),
                                p.legByes(),
                                p.penaltyRuns(),
                                p.itemised(),
                                p.notItemised(),
                                p.total()))
                        .toList(),
                d.extrasSummary(),
                d.dotBalls().stream()
                        .map(p -> new MyTeamStatsDto.MyTeamDotBallsPoint(
                                p.matchId(), p.matchDate(), p.opponentName(), p.derby(), p.ballsBowled(), p.dots(), p.dotPercent()))
                        .toList(),
                d.dotBallsSummary());
    }
}
