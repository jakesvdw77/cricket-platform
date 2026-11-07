package com.cricketlegend.service.support;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.dto.MyStatsDto;
import com.cricketlegend.dto.PlayerDashboardDto;
import com.cricketlegend.dto.PlayerMatchRowDto;
import com.cricketlegend.dto.PlayerStatsDto;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/147: the one pure place that assembles the Player Hub "My stats" payload. It defines no figure: every value is
 * a counter of {@link PlayerStatsDto} (already the calculator's output), a Dashboard series point, or the result of a
 * {@link PlayerStatsCalculator} method. Its own work is shaping (dropping internal ids, attaching drill tokens). No Spring,
 * repository, entity, caller or access information.
 */
public final class MyStatsBuilder {

    private MyStatsBuilder() {}

    /** The caller-independent inputs that are not in the history (the service reads them through the other repositories). */
    public record Extras(
            String playerFirstName,
            LocalDate dateOfBirth,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            StatsScope.Competition competition,
            List<PlayerStatsCalculator.SeasonCounters> seasons,
            Collection<PlayerStatsCalculator.PollFact> polls,
            Collection<PlayerStatsCalculator.SelectionFact> selections,
            Long fixturesRemaining,
            MyStatsDto.MyStatsTeamFielding teamFielding,
            Integer teamFieldingRank,
            MyStatsDto.MyStatsStanding standing) {
    }

    public static MyStatsDto build(PlayerStatsDto stats, HeldPlayerHistory history, Extras extras) {
        List<PlayerMatchRowDto> rows = history.rowsOldestFirst();
        List<PlayerStatsCalculator.InningsDetail> innings =
                PlayerStatsCalculator.joinInnings(rows, history.battingDetail());
        Instant latest = rows.isEmpty() ? null : rows.get(rows.size() - 1).matchDate();
        PlayerStatsCalculator.AgeBand band = PlayerStatsCalculator.ageBand(extras.dateOfBirth(), latest);
        PlayerStatsCounters counters = history.counters();
        return new MyStatsDto(
                new MyStatsDto.MyStatsScope(
                        extras.seasonId(),
                        extras.leagueId(),
                        extras.teamId(),
                        extras.competition() == null ? null : extras.competition().name()),
                extras.playerFirstName(),
                band.name(),
                new MyStatsDto.MyStatsBasis(
                        stats.basis().matchesCounted(),
                        stats.basis().resultsWithBattingCard(),
                        stats.basis().resultsWithBowlingCard(),
                        PlayerStatsCalculator.resultsWithFieldingCard(rows),
                        extras.fixturesRemaining(),
                        history.truncated(),
                        DashboardLimits.HISTORY_CAP),
                stats.batting(),
                stats.bowling(),
                stats.fielding(),
                stats.awards(),
                stats.record(),
                stats.form(),
                series(history.series()),
                PlayerStatsCalculator.rolling(innings),
                PlayerStatsCalculator.guides(band),
                PlayerStatsCalculator.bands(innings),
                PlayerStatsCalculator.byInningsNumber(innings),
                PlayerStatsCalculator.byOpposition(innings),
                PlayerStatsCalculator.dismissedBy(innings),
                PlayerStatsCalculator.wicketsByPosition(history.wicketDetail()),
                PlayerStatsCalculator.milestones(counters, rows, innings),
                PlayerStatsCalculator.teamRecordWhenScoring(rows, innings),
                PlayerStatsCalculator.homeAway(innings),
                PlayerStatsCalculator.bySeason(extras.seasons()),
                PlayerStatsCalculator.bowlingDiscipline(counters, rows),
                PlayerStatsCalculator.availability(
                        extras.polls(),
                        extras.selections(),
                        stats.basis().matchesCounted(),
                        extras.seasonId(),
                        extras.leagueId(),
                        extras.teamId(),
                        extras.competition()),
                extras.teamFielding(),
                extras.teamFieldingRank(),
                extras.standing(),
                stats.notCaptured());
    }

    /** The Dashboard series without result ids, with a drill token on every dismissal slice. */
    static MyStatsDto.MyStatsSeries series(PlayerDashboardDto d) {
        return new MyStatsDto.MyStatsSeries(
                d.window(),
                d.battingInnings().stream()
                        .map(i -> new MyStatsDto.MyStatsSeriesInnings(
                                i.matchId(), i.matchDate(), i.opponentName(), i.derby(), i.runs(), i.balls(), i.notOut(), i.howOut()))
                        .toList(),
                d.battingSummary(),
                d.dismissals().stream()
                        .map(s -> new MyStatsDto.MyStatsDismissal(
                                s.type(),
                                s.label(),
                                s.count(),
                                s.percent(),
                                StatsDrillFilter.dismissalToken(DismissalType.valueOf(s.type()))))
                        .toList(),
                d.battingTrend().stream()
                        .map(t -> new MyStatsDto.MyStatsTrendPoint(
                                t.matchId(),
                                t.matchDate(),
                                t.opponentName(),
                                t.derby(),
                                t.cumulativeRuns(),
                                t.cumulativeDismissals(),
                                t.average()))
                        .toList(),
                d.bowlingMatches().stream()
                        .map(m -> new MyStatsDto.MyStatsBowlingMatch(
                                m.matchId(),
                                m.matchDate(),
                                m.opponentName(),
                                m.derby(),
                                m.balls(),
                                m.ballsPerOver(),
                                m.maidens(),
                                m.runs(),
                                m.wickets(),
                                m.economy()))
                        .toList(),
                d.wicketTypes(),
                d.economySummary());
    }
}
