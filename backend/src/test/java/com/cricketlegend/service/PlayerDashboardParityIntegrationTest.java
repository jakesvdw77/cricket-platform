package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.PlayerDashboardDto;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardBattingInnings;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardBowlingMatch;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardDismissal;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardWicketType;
import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.support.PlayerStatsSeed;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/117-stats-dashboard.md, "Parity tests (the key ones)": for every seeded player and a set of filter
 * combinations (the values the page's FilterBar sends), the Dashboard series add up to the same player's
 * {@code PlayerStatsDto} (the Runs, Wickets and Econ figures behind the tiles and the Batting and Bowling tabs). The two
 * are independent read paths (the Dashboard's row builder and facts queries against the aggregate SQL's {@code sum()}),
 * which is what makes the test meaningful. Windowed per-match charts (more than 30 points) are compared through the
 * whole-history figures; the sums of the drawn points are compared wherever the window does not bind. Not
 * {@code @Transactional}.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class PlayerDashboardParityIntegrationTest {

    @Autowired
    private PlayerStatsService playerStatsService;

    @Autowired
    private PlayerDashboardService dashboardService;

    @Autowired
    private ApplicationContext context;

    private PlayerStatsSeed seed;
    private UUID clubId;
    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    @BeforeEach
    void setUp() {
        seed = new PlayerStatsSeed(context);
        seed.seedMatchList();
        seed.seedDashboard(36);
        clubId = seed.w.club().getId();
    }

    @AfterEach
    void cleanUp() {
        seed.cleanUp();
    }

    /** season, league, team, section, competition; any of them null for "no filter". */
    private record Filters(String name, UUID season, UUID league, UUID team, UUID section, String competition) {
    }

    private List<Filters> filterSets() {
        return List.of(
                new Filters("career", null, null, null, null, null),
                new Filters("season 1", seed.s1.getId(), null, null, null, null),
                new Filters("season 2", seed.s2.getId(), null, null, null, null),
                new Filters("league 1", null, seed.l1.getId(), null, null, null),
                new Filters("league 2", null, seed.l2.getId(), null, null, null),
                new Filters("team seniors1", null, null, seed.w.seniors1().getId(), null, null),
                new Filters("team seniors2", null, null, seed.w.seniors2().getId(), null, null),
                new Filters("team Eagles", null, null, seed.dbEagles.getId(), null, null),
                new Filters("team Rooks", null, null, seed.dbRooks.getId(), null, null),
                new Filters("section seniors", null, null, null, seed.w.seniors().getId(), null),
                new Filters("section seniors A", null, null, null, seed.seniorsA.getId(), null),
                new Filters("section juniors", null, null, null, seed.w.juniors().getId(), null),
                new Filters("season 2 friendlies", seed.s2.getId(), null, null, null, "FRIENDLY"),
                new Filters("season 1, league 1, Eagles", seed.s1.getId(), seed.l1.getId(), seed.dbEagles.getId(), null,
                        null),
                new Filters("everything", seed.s1.getId(), seed.l1.getId(), seed.w.seniors1().getId(),
                        seed.w.seniors().getId(), "LEAGUE"),
                new Filters("friendly", null, null, null, null, "FRIENDLY"),
                new Filters("league games", null, null, null, null, "LEAGUE"));
    }

    private List<PlayerProfile> everyone() {
        return List.of(seed.alice, seed.bob, seed.cara, seed.dan, seed.erin, seed.eve, seed.fay, seed.grace,
                seed.frank, seed.gina, seed.hank, seed.ivy, seed.jill, seed.kim, seed.leo, seed.mona, seed.nina,
                seed.pia, seed.dash, seed.mate, seed.dee, seed.over);
    }

    private PlayerStatsDto stats(PlayerProfile p, Filters f) {
        return playerStatsService.get(admin, clubId, p.getId(), f.season(), f.league(), f.team(), f.section(),
                f.competition());
    }

    private PlayerDashboardDto dashboard(PlayerProfile p, Filters f) {
        return dashboardService.get(admin, clubId, p.getId(), f.season(), f.league(), f.team(), f.section(),
                f.competition());
    }

    @Test
    void everyDashboardTotalEqualsThePlayerPageFigureForEveryPlayerAndFilterSet() {
        Counts counts = new Counts();
        for (Filters f : filterSets()) {
            for (PlayerProfile p : everyone()) {
                String who = f.name() + "/" + p.getId();
                List<String> problems = new ArrayList<>();
                compare(who, stats(p, f), dashboard(p, f), seed.over.equals(p), problems, counts);
                assertThat(problems).as(who).isEmpty();
            }
        }
        assertThat(counts.combos).isEqualTo(filterSets().size() * everyone().size());
        assertThat(counts.checks).as("non-vacuous: figures compared").isGreaterThan(2500);
        assertThat(counts.withRuns).as("non-vacuous: combinations with batting").isGreaterThan(50);
        assertThat(counts.withWickets).as("non-vacuous: combinations with wickets").isGreaterThan(15);
        assertThat(counts.windowedBatting).as("windowed batting charts (the sum of the points is not compared)").isGreaterThan(3);
        assertThat(counts.unwindowedBatting).as("unwindowed batting charts: the sum of the points was compared").isGreaterThan(40);
        assertThat(counts.unwindowedBowling).as("unwindowed bowling charts compared").isGreaterThan(15);
        assertThat(counts.windowedBowling).isGreaterThan(1);
        assertThat(counts.modesCompared).as("types agreed with the Bowling tab's dismissalModes").isGreaterThan(8);
        assertThat(counts.economyCompared).as("economy reference lines compared").isGreaterThan(15);
        assertThat(counts.itemisedSomething).as("some wickets were itemised").isGreaterThan(3);
    }

    @Test
    void theDerbyAndTheZeroBallWicketRowAreInTheTotalsAsTheyAreOnThePage() {
        // Dee's derby: runs 30 + 8, one bowling match of 18 balls
        PlayerStatsDto s = stats(seed.dee, filterSets().get(0));
        PlayerDashboardDto d = dashboard(seed.dee, filterSets().get(0));
        assertThat(d.battingSummary().runs()).isEqualTo(s.batting().runs()).isEqualTo(38);
        assertThat(d.bowlingMatches().stream().mapToLong(PlayerDashboardBowlingMatch::wickets).sum())
                .isEqualTo(s.bowling().wickets());
        // Mona's stored 0-ball, 0-run wicket row (spec 115 gap) is in the Wickets figure, so it is in the types total
        PlayerDashboardDto mona = dashboard(seed.mona, filterSets().get(0));
        assertThat(mona.wicketTypes().total()).isEqualTo(stats(seed.mona, filterSets().get(0)).bowling().wickets()).isEqualTo(3);
        assertThat(mona.wicketTypes().notItemised().count()).as("no opposition card names Mona").isEqualTo(3);
    }

    // ---- the comparison ----

    private static final class Counts {
        int combos;
        int checks;
        int withRuns;
        int withWickets;
        int windowedBatting;
        int unwindowedBatting;
        int windowedBowling;
        int unwindowedBowling;
        int modesCompared;
        int economyCompared;
        int itemisedSomething;
    }

    private void compare(String who, PlayerStatsDto s, PlayerDashboardDto d, boolean overCredited, List<String> problems,
            Counts counts) {
        var bat = s.batting();
        var bowl = s.bowling();
        counts.combos++;

        // basis and scope are the page's
        eq(problems, who + " matches counted", d.basis().matchesCounted(), s.basis().matchesCounted());
        eq(problems, who + " batting cards", d.basis().resultsWithBattingCard(), s.basis().resultsWithBattingCard());
        eq(problems, who + " bowling cards", d.basis().resultsWithBowlingCard(), s.basis().resultsWithBowlingCard());
        check(problems, who + " scope", d.scope().equals(s.scope()));
        counts.checks += 4;

        // batting: Runs tile, innings, not outs, average
        eq(problems, who + " runs", d.battingSummary().runs(), bat.runs());
        eq(problems, who + " innings", d.battingSummary().inningsTotal(), bat.innings());
        eq(problems, who + " not outs", d.battingSummary().notOuts(), bat.notOuts());
        eq(problems, who + " trend length", d.battingTrend().size(), bat.innings());
        eq(problems, who + " dismissals sum = innings", d.dismissals().stream().mapToLong(PlayerDashboardDismissal::count).sum(),
                bat.innings());
        eq(problems, who + " not-out slice", d.dismissals().stream().filter(x -> x.type().equals("NOT_OUT"))
                .mapToLong(PlayerDashboardDismissal::count).sum(), bat.notOuts());
        same(problems, who + " average line", d.battingSummary().averageRuns(), bat.average());
        counts.checks += 7;
        if (!d.battingTrend().isEmpty()) {
            var lastPoint = d.battingTrend().get(d.battingTrend().size() - 1);
            eq(problems, who + " last cumulative runs", lastPoint.cumulativeRuns(), bat.runs());
            same(problems, who + " last trend average", lastPoint.average(), bat.average());
            eq(problems, who + " last cumulative dismissals", lastPoint.cumulativeDismissals(), bat.dismissals());
            counts.checks += 3;
            counts.withRuns++;
        }
        for (PlayerDashboardDismissal slice : d.dismissals()) {
            if (!slice.type().equals("NOT_OUT")) {
                eq(problems, who + " dismissal " + slice.type(), slice.count(),
                        bat.dismissalModes().getOrDefault(slice.type(), 0L));
                counts.checks++;
            }
        }
        if (bat.innings() <= d.window().pointLimit()) {
            eq(problems, who + " sum of runs per innings", d.battingInnings().stream()
                    .mapToLong(PlayerDashboardBattingInnings::runs).sum(), bat.runs());
            eq(problems, who + " points = innings", d.battingInnings().size(), bat.innings());
            eq(problems, who + " not-out points", d.battingInnings().stream().filter(PlayerDashboardBattingInnings::notOut).count(),
                    bat.notOuts());
            counts.checks += 3;
            if (bat.innings() > 0) {
                counts.unwindowedBatting++;
            }
        } else {
            counts.windowedBatting++;
            eq(problems, who + " windowed points", d.battingInnings().size(), d.window().pointLimit());
        }

        // bowling: Wickets tile, wicket types, Econ
        var wt = d.wicketTypes();
        eq(problems, who + " wicket types total", wt.total(), bowl.wickets());
        eq(problems, who + " types + not itemised", wt.types().stream().mapToLong(PlayerDashboardWicketType::count).sum()
                + wt.notItemised().count(), bowl.wickets());
        eq(problems, who + " itemised", wt.itemised(), wt.types().stream().mapToLong(PlayerDashboardWicketType::count).sum());
        eq(problems, who + " coverage total", wt.coverage().wicketsTotal(), bowl.wickets());
        counts.checks += 4;
        if (bowl.wickets() > 0) {
            counts.withWickets++;
        }
        if (wt.itemised() > 0) {
            counts.itemisedSomething++;
        }
        if (!overCredited) {
            // the Bowling tab's dismissalModes and the donut are the same definition when no innings is over-credited
            for (PlayerDashboardWicketType t : wt.types()) {
                eq(problems, who + " type " + t.type() + " vs dismissalModes", t.count(), bowl.dismissalModes().getOrDefault(t.type(), 0L));
                counts.checks++;
            }
            eq(problems, who + " not itemised vs not recorded", wt.notItemised().count(), bowl.dismissalsNotRecorded());
            counts.checks++;
            counts.modesCompared++;
        }
        same(problems, who + " overall economy", d.economySummary().overallEconomy(), bowl.economy());
        counts.checks++;
        if (bowl.economy() != null) {
            counts.economyCompared++;
        }
        long bowledMatches = d.economySummary().totalPoints();
        if (bowledMatches <= d.window().pointLimit()) {
            eq(problems, who + " sum of wickets per match", d.bowlingMatches().stream()
                    .mapToLong(PlayerDashboardBowlingMatch::wickets).sum(), bowl.wickets());
            eq(problems, who + " sum of runs conceded", d.bowlingMatches().stream()
                    .mapToLong(PlayerDashboardBowlingMatch::runs).sum(), bowl.runsConceded());
            eq(problems, who + " sum of balls", d.bowlingMatches().stream()
                    .mapToLong(PlayerDashboardBowlingMatch::balls).sum(), bowl.ballsBowled());
            counts.checks += 3;
            if (bowledMatches > 0) {
                counts.unwindowedBowling++;
            }
        } else {
            counts.windowedBowling++;
            eq(problems, who + " windowed bowling points", d.bowlingMatches().size(), d.window().pointLimit());
        }
        eq(problems, who + " economy matches", d.economySummary().matchesCounted(), d.bowlingMatches().size());
        counts.checks++;
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
