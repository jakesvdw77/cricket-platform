package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.TeamDashboardDto;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardDotBallsPoint;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardExtrasPoint;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardResult;
import com.cricketlegend.dto.TeamStatsDto;
import com.cricketlegend.support.PlayerStatsSeed;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/117-stats-dashboard.md, "Parity tests (the key ones)": for every seeded team and a set of filter
 * combinations (the values the team page's FilterBar sends), the team Dashboard series add up to the same team's
 * {@code TeamStatsDto}: the record, the runs scored and conceded, the run rate and economy, the Net Run Rate and its status
 * and each extras figure of the Extras card; the dot balls are checked straight against the seeded bowler rows (read with
 * plain SQL). The two are independent read paths. Per-match sums are compared wherever the 30-point window does not bind;
 * the running and whole-history figures always. Not {@code @Transactional}.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class TeamDashboardParityIntegrationTest {

    @Autowired
    private TeamStatsService teamStatsService;

    @Autowired
    private TeamDashboardService dashboardService;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ApplicationContext context;

    private PlayerStatsSeed seed;
    private UUID clubId;
    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    @BeforeEach
    void setUp() {
        seed = new PlayerStatsSeed(context);
        seed.seedMatchList();
        seed.seedTeamStats();
        seed.seedDashboard(36);
        clubId = seed.w.club().getId();
    }

    @AfterEach
    void cleanUp() {
        seed.cleanUp();
    }

    /** season, league, competition; any of them null for "no filter". */
    private record Filters(String name, UUID season, UUID league, String competition) {
    }

    private List<Filters> filterSets() {
        return List.of(
                new Filters("none", null, null, null),
                new Filters("season 1", seed.s1.getId(), null, null),
                new Filters("season 2", seed.s2.getId(), null, null),
                new Filters("league 1", null, seed.l1.getId(), null),
                new Filters("league 2", null, seed.l2.getId(), null),
                new Filters("league games", null, null, "LEAGUE"),
                new Filters("friendlies", null, null, "FRIENDLY"),
                new Filters("season 1, league 1", seed.s1.getId(), seed.l1.getId(), null),
                new Filters("season 1, league 2", seed.s1.getId(), seed.l2.getId(), null),
                new Filters("season 2, league 1, LEAGUE", seed.s2.getId(), seed.l1.getId(), "LEAGUE"),
                new Filters("season 2 friendlies", seed.s2.getId(), null, "FRIENDLY"));
    }

    private List<Team> everyTeam() {
        return List.of(seed.w.seniors1(), seed.w.seniors2(), seed.w.juniorsTeam(), seed.gcTeam, seed.tsHawks,
                seed.tsKites, seed.tsOwls, seed.tsSwifts, seed.tsDoves, seed.tsWrens, seed.dbEagles, seed.dbRooks);
    }

    private static final class Counts {
        int combos;
        int checks;
        int withResults;
        int nrrShown;
        int nrrNotShown;
        int forfeitTeams;
        int derbyTeams;
        int unwindowedRuns;
        int windowedRuns;
        int extrasCompared;
        int dotsPointsCompared;
        int dotsNullAsRequired;
        int pooledCompared;
        int runRateCompared;
    }

    @Test
    void everyDashboardTotalEqualsTheTeamPageFigureForEveryTeamAndFilterSet() {
        Counts counts = new Counts();
        for (Filters f : filterSets()) {
            for (Team t : everyTeam()) {
                TeamStatsDto page = teamStatsService.team(admin, clubId, t.getId(), f.season(), f.league(), f.competition());
                TeamDashboardDto d = dashboardService.get(admin, clubId, t.getId(), f.season(), f.league(), f.competition());
                String who = f.name() + "/" + t.getName();
                List<String> problems = new ArrayList<>();
                compare(who, t, page, d, problems, counts);
                assertThat(problems).as(who).isEmpty();
            }
        }
        assertThat(counts.combos).isEqualTo(filterSets().size() * everyTeam().size());
        assertThat(counts.checks).as("non-vacuous: figures compared").isGreaterThan(1500);
        assertThat(counts.withResults).as("combinations with results").isGreaterThan(40);
        assertThat(counts.nrrShown).as("a shown net run rate was compared").isGreaterThan(5);
        assertThat(counts.nrrNotShown).as("a net run rate that is not shown was compared").isGreaterThan(20);
        assertThat(counts.forfeitTeams).as("combinations with forfeits").isGreaterThan(3);
        assertThat(counts.derbyTeams).as("combinations with a derby").isGreaterThan(5);
        assertThat(counts.unwindowedRuns).as("sum of per-match runs compared").isGreaterThan(30);
        assertThat(counts.windowedRuns).as("windowed (more than 30 results) combinations").isGreaterThan(1);
        assertThat(counts.extrasCompared).as("extras sums compared with the Extras card").isGreaterThan(15);
        assertThat(counts.dotsPointsCompared).as("dot-ball points compared with the bowler rows").isGreaterThan(80);
        assertThat(counts.dotsNullAsRequired).as("points with a blank bowler row had no dots").isGreaterThan(15);
        assertThat(counts.pooledCompared).as("pooled dot averages compared").isGreaterThan(5);
        assertThat(counts.runRateCompared).as("run rate and economy lines compared").isGreaterThan(30);
    }

    // ---- the comparison ----

    private void compare(String who, Team team, TeamStatsDto page, TeamDashboardDto d, List<String> problems, Counts counts) {
        counts.combos++;
        var rec = page.record();
        var s = d.resultsSummary();

        // the record and tiles
        eq(problems, who + " played", s.played(), rec.played());
        eq(problems, who + " won", s.won(), rec.won());
        eq(problems, who + " lost", s.lost(), rec.lost());
        eq(problems, who + " tied", s.tied(), rec.tied());
        eq(problems, who + " drawn", s.drawn(), rec.drawn());
        eq(problems, who + " no result", s.noResult(), rec.noResult());
        eq(problems, who + " forfeits", s.forfeits(), page.basis().forfeits().received() + page.basis().forfeits().conceded());
        eq(problems, who + " results counted", s.totalPoints(), page.basis().resultsCounted());
        eq(problems, who + " sum of the five", s.won() + s.lost() + s.tied() + s.drawn() + s.noResult(), s.played());
        same(problems, who + " won %", s.wonPercent(), pct(s.won(), s.played()));
        same(problems, who + " lost %", s.lostPercent(), pct(s.lost(), s.played()));
        same(problems, who + " tied %", s.tiedPercent(), pct(s.tied(), s.played()));
        same(problems, who + " drawn %", s.drawnPercent(), pct(s.drawn(), s.played()));
        same(problems, who + " no result %", s.noResultPercent(), pct(s.noResult(), s.played()));
        check(problems, who + " basis", d.basis().equals(page.basis()));
        check(problems, who + " scope", d.scope().equals(page.scope()));
        check(problems, who + " not truncated", !d.truncated());
        counts.checks += 17;
        if (s.played() > 0) {
            counts.withResults++;
        }
        if (s.forfeits() > 0) {
            counts.forfeitTeams++;
        }
        if (page.basis().internalResults() > 0) {
            counts.derbyTeams++;
        }
        eq(problems, who + " shown", d.results().size(), Math.min(s.played(), d.window().pointLimit()));

        // run rate and economy: the last running point is the tab's figure
        var bat = page.batting();
        var bowl = page.bowling();
        if (d.runRateTrend().isEmpty()) {
            check(problems, who + " no run rate when none plotted", bat.runRate() == null && bowl.economy() == null);
        } else {
            var last = d.runRateTrend().get(d.runRateTrend().size() - 1);
            same(problems, who + " last team run rate", last.teamRunRate(), bat.runRate());
            same(problems, who + " last opposition run rate", last.oppositionRunRate(), bowl.economy());
            counts.runRateCompared++;
        }
        counts.checks += 2;

        // net run rate: status and the last running value
        var nrr = page.netRunRate();
        check(problems, who + " nrr status " + d.netRunRateTrend().status() + " vs " + nrr.status(), d.netRunRateTrend().status().equals(nrr.status()));
        if ("SHOWN".equals(nrr.status())) {
            counts.nrrShown++;
            check(problems, who + " nrr points exist", !d.netRunRateTrend().points().isEmpty());
            if (!d.netRunRateTrend().points().isEmpty()) {
                same(problems, who + " last nrr", d.netRunRateTrend().points().get(d.netRunRateTrend().points().size() - 1).value(),
                        nrr.value());
                eq(problems, who + " nrr points = used", d.netRunRateTrend().points().size(), nrr.matchesUsed());
            }
        } else {
            counts.nrrNotShown++;
            check(problems, who + " no nrr points when " + nrr.status(), d.netRunRateTrend().points().isEmpty());
        }
        counts.checks += 3;

        // runs scored and conceded, wickets and balls, summed over the plotted results when the window does not bind
        if (s.played() <= d.window().pointLimit()) {
            sumEq(problems, who + " runs scored", d.results(), TeamDashboardResult::ownRuns, bat.runs());
            sumEq(problems, who + " runs conceded", d.results(), TeamDashboardResult::oppRuns, bowl.runsConceded());
            sumEq(problems, who + " wickets lost", d.results(), TeamDashboardResult::ownWickets, bat.wicketsLost());
            sumEq(problems, who + " wickets taken", d.results(), TeamDashboardResult::oppWickets, bowl.wicketsTaken());
            sumEq(problems, who + " balls faced", d.results(), TeamDashboardResult::ownBalls, bat.ballsFaced());
            sumEq(problems, who + " balls bowled", d.results(), TeamDashboardResult::oppBalls, bowl.ballsBowled());
            long forfeitPoints = d.results().stream().filter(TeamDashboardResult::forfeit).count();
            eq(problems, who + " forfeit points", forfeitPoints, s.forfeits());
            d.results().stream().filter(TeamDashboardResult::forfeit).forEach(r -> check(problems,
                    who + " a forfeit has no runs", r.ownRuns() == null && r.oppRuns() == null));
            counts.checks += 8;
            if (s.played() > 0) {
                counts.unwindowedRuns++;
            }
        } else {
            counts.windowedRuns++;
        }

        // extras: each type's sum equals the Extras card's figure, with the same coverage
        var ex = page.extras();
        var sum = d.extrasSummary();
        // one point per result, so the seeded multi-innings draw (Ivy, Seniors 2: two opposition innings) is one point
        boolean multiInnings = team.getId().equals(seed.w.seniors2().getId()) && ex.coverage().inningsCounted() > 0;
        check(problems, who + " extras points " + sum.totalPoints() + " vs opposition innings " + ex.coverage().inningsCounted(),
                multiInnings ? sum.totalPoints() <= ex.coverage().inningsCounted()
                        : sum.totalPoints() == ex.coverage().inningsCounted());
        counts.checks++;
        if (sum.totalPoints() <= d.window().pointLimit()) {
            List<TeamDashboardExtrasPoint> pts = d.extrasConceded();
            sumEq(problems, who + " extras total", pts, TeamDashboardExtrasPoint::total, ex.conceded());
            sumEq(problems, who + " wides", pts, TeamDashboardExtrasPoint::wides, ex.wides());
            sumEq(problems, who + " no-balls", pts, TeamDashboardExtrasPoint::noBalls, ex.noBalls());
            sumEq(problems, who + " byes", pts, TeamDashboardExtrasPoint::byes, ex.byes());
            sumEq(problems, who + " leg byes", pts, TeamDashboardExtrasPoint::legByes, ex.legByes());
            sumEq(problems, who + " penalty runs", pts, TeamDashboardExtrasPoint::penaltyRuns, ex.penaltyRuns());
            eq(problems, who + " with extras", sum.matchesWithExtras(), ex.coverage().inningsWithExtras());
            var cc = ex.componentCoverage();
            eq(problems, who + " wides recorded", sum.widesRecorded(), cc.wides().inningsRecorded());
            eq(problems, who + " no-balls recorded", sum.noBallsRecorded(), cc.noBalls().inningsRecorded());
            eq(problems, who + " byes recorded", sum.byesRecorded(), cc.byes().inningsRecorded());
            eq(problems, who + " leg byes recorded", sum.legByesRecorded(), cc.legByes().inningsRecorded());
            eq(problems, who + " penalty recorded", sum.penaltyRunsRecorded(), cc.penaltyRuns().inningsRecorded());
            counts.checks += 12;
            if (ex.conceded() != null) {
                counts.extrasCompared++;
            }
        }

        // dot balls: straight against the seeded bowler rows
        long dotsSum = 0;
        long ballsSum = 0;
        for (TeamDashboardDotBallsPoint p : d.dotBalls()) {
            Map<String, Object> row = bowlerRows(p.resultId(), p.matchId(), team);
            long allRows = ((Number) row.get("all_rows")).longValue();
            long bowledRows = ((Number) row.get("bowled_rows")).longValue();
            long dottedRows = ((Number) row.get("dotted_rows")).longValue();
            Number balls = (Number) row.get("balls");
            Number dots = (Number) row.get("dots");
            if (allRows == 0) {
                check(problems, who + " no bowler row, no balls", p.ballsBowled() == null && p.dots() == null);
            } else {
                eq(problems, who + " balls bowled " + p.matchId(), p.ballsBowled() == null ? -1 : p.ballsBowled(), balls.longValue());
            }
            boolean allRecorded = dots != null && bowledRows == dottedRows;
            if (allRecorded) {
                eq(problems, who + " dots " + p.matchId(), p.dots() == null ? -1 : p.dots(), dots.longValue());
                if (balls.longValue() > 0) {
                    same(problems, who + " dot % " + p.matchId(), p.dotPercent(),
                            BigDecimal.valueOf(dots.longValue() * 100).divide(BigDecimal.valueOf(balls.longValue()), 1, RoundingMode.HALF_UP));
                    dotsSum += dots.longValue();
                    ballsSum += balls.longValue();
                }
            } else {
                check(problems, who + " one blank bowler row, so no dots " + p.matchId(), p.dots() == null && p.dotPercent() == null);
                if (bowledRows > dottedRows) {
                    counts.dotsNullAsRequired++;
                }
            }
            counts.dotsPointsCompared++;
            counts.checks += 3;
        }
        var ds = d.dotBallsSummary();
        eq(problems, who + " dots points counted", ds.matchesCounted(), d.dotBalls().size());
        eq(problems, who + " dots charted", ds.matchesWithDots(), d.dotBalls().stream().filter(p -> p.dotPercent() != null).count());
        same(problems, who + " pooled dot average", ds.averageDotPercent(),
                ballsSum == 0 ? null : BigDecimal.valueOf(dotsSum * 100).divide(BigDecimal.valueOf(ballsSum), 1, RoundingMode.HALF_UP));
        counts.checks += 3;
        if (ballsSum > 0) {
            counts.pooledCompared++;
        }
    }

    /** The team's own bowler rows of one result, read straight from the tables. */
    private Map<String, Object> bowlerRows(UUID resultId, UUID matchId, Team team) {
        String side = jdbc.queryForObject("select case when home_team_id = ? then 'HOME' else 'AWAY' end from match where id = ?",
                String.class, team.getId(), matchId);
        return jdbc.queryForMap("""
                select count(*) as all_rows,
                       coalesce(sum(bw.balls), 0) as balls,
                       sum(bw.dots) as dots,
                       count(*) filter (where bw.balls > 0) as bowled_rows,
                       count(bw.dots) filter (where bw.balls > 0) as dotted_rows
                from bowling_entry bw
                join match_innings i on i.id = bw.match_innings_id and i.kind = 'REGULAR'
                join result_player rp on rp.id = bw.result_player_id
                where i.match_result_id = ? and rp.opposition = false and rp.side = ? and i.batting_side <> rp.side
                """, resultId, side);
    }

    private static BigDecimal pct(long part, long total) {
        return total <= 0 ? null : BigDecimal.valueOf(part * 100).divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }

    private static <T> void sumEq(List<String> problems, String what, List<T> points, Function<T, ? extends Number> value,
            Long page) {
        long sum = points.stream().map(value).filter(v -> v != null).mapToLong(Number::longValue).sum();
        check(problems, what + ": dashboard " + sum + " vs page " + page, page == null ? sum == 0 : sum == page);
    }

    private static void eq(List<String> problems, String what, long actual, long expected) {
        check(problems, what + ": dashboard " + actual + " vs page " + expected, actual == expected);
    }

    private static void same(List<String> problems, String what, BigDecimal actual, BigDecimal expected) {
        boolean ok = expected == null ? actual == null : actual != null && expected.compareTo(actual) == 0;
        check(problems, what + ": dashboard " + actual + " vs page " + expected, ok);
    }

    private static void check(List<String> problems, String message, boolean ok) {
        if (!ok) {
            problems.add(message);
        }
    }
}
