package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.dto.TeamDashboardDto;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardDotBallsPoint;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardExtrasPoint;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardResult;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.support.PlayerStatsSeed;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Predicate;
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
 * docs/specs/117-stats-dashboard.md, "Backend integration": the team Dashboard series for the {@link PlayerStatsSeed}
 * Dashboard scenarios (Eagles: 36 generated matches plus an over-credit pair, a derby, two forfeits, a result with no
 * opposition innings and a no-ball result), checked against hand-coded expectations from the seed's formulas. The parity
 * with the team page is in {@code TeamDashboardParityIntegrationTest}. Not {@code @Transactional}.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class TeamDashboardServiceIntegrationTest {

    private static final int N = 36;

    @Autowired
    private TeamDashboardService service;

    @Autowired
    private ApplicationContext context;

    private PlayerStatsSeed seed;
    private PlayerStatsSeed big;
    private UUID clubId;
    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    @BeforeEach
    void setUp() {
        seed = new PlayerStatsSeed(context);
        seed.seedDashboard(N);
        clubId = seed.w.club().getId();
    }

    @AfterEach
    void cleanUp() {
        seed.cleanUp();
        if (big != null) {
            big.cleanUp();
        }
    }

    private TeamDashboardDto eagles() {
        return service.get(admin, clubId, seed.dbEagles.getId(), null, null, null);
    }

    /** The counted Eagles results in the order they were played (the no-ball result is not one). */
    private List<String> keys() {
        return keys(seed);
    }

    private static List<String> keys(PlayerStatsSeed s) {
        List<String> keys = new ArrayList<>(s.dbMatches.keySet());
        keys.remove("NO_BALL");
        return keys;
    }

    private static <T> List<T> last(List<T> list, int n) {
        return list.subList(Math.max(0, list.size() - n), list.size());
    }

    private static int index(String key) {
        return key.startsWith("M") ? Integer.parseInt(key.substring(1)) : -1;
    }

    private static String letter(String key) {
        if (key.startsWith("M")) {
            return switch (index(key) % 7) {
                case 0, 1, 4 -> "WON";
                case 2 -> "LOST";
                case 3 -> "TIED";
                case 5 -> "DRAWN";
                default -> "NO_RESULT";
            };
        }
        return key.equals("FORFEIT_CONCEDED") ? "LOST" : "WON";
    }

    private static BigDecimal pct(long part, long total) {
        return total <= 0 ? null : BigDecimal.valueOf(part * 100).divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }

    // ---- results ----

    @Test
    void theResultsAreTheLastThirtyCountedResultsOldestFirst_andTheDonutCountsEveryOne() {
        TeamDashboardDto d = eagles();
        List<String> keys = keys();
        assertThat(keys).hasSize(42);

        assertThat(d.teamName()).isEqualTo("DB Eagles");
        assertThat(d.window().pointLimit()).isEqualTo(30);
        assertThat(d.truncated()).isFalse();
        assertThat(d.results()).hasSize(30);
        List<String> shown = last(keys, 30);
        for (int k = 0; k < 30; k++) {
            TeamDashboardResult r = d.results().get(k);
            String key = shown.get(k);
            assertThat(r.matchId()).as("order " + k + " " + key).isEqualTo(seed.dbMatches.get(key).getId());
            assertThat(r.result()).as(key).isEqualTo(letter(key));
        }

        long won = keys.stream().filter(k -> letter(k).equals("WON")).count();
        long lost = keys.stream().filter(k -> letter(k).equals("LOST")).count();
        long tied = keys.stream().filter(k -> letter(k).equals("TIED")).count();
        long drawn = keys.stream().filter(k -> letter(k).equals("DRAWN")).count();
        long noResult = keys.stream().filter(k -> letter(k).equals("NO_RESULT")).count();
        var s = d.resultsSummary();
        assertThat(s.played()).isEqualTo(42);
        assertThat(s.won()).isEqualTo(won).isEqualTo(21);
        assertThat(s.lost()).isEqualTo(lost).isEqualTo(6);
        assertThat(s.tied()).isEqualTo(tied).isEqualTo(5);
        assertThat(s.drawn()).isEqualTo(drawn).isEqualTo(5);
        assertThat(s.noResult()).isEqualTo(noResult).isEqualTo(5);
        assertThat(s.forfeits()).isEqualTo(2);
        assertThat(s.totalPoints()).isEqualTo(42);
        assertThat(s.shown()).isEqualTo(30);
        assertThat(s.wonPercent()).isEqualByComparingTo(pct(won, 42));
        assertThat(s.lostPercent()).isEqualByComparingTo(pct(lost, 42));
        assertThat(s.tiedPercent()).isEqualByComparingTo(pct(tied, 42));
        assertThat(s.drawnPercent()).isEqualByComparingTo(pct(drawn, 42));
        assertThat(s.noResultPercent()).isEqualByComparingTo(pct(noResult, 42));
        assertThat(d.basis().resultsCounted()).isEqualTo(42);
        assertThat(d.basis().resultsNoBallBowled()).as("the no-ball result is reported, not counted").isEqualTo(1);
        assertThat(d.results()).extracting(TeamDashboardResult::matchId).doesNotContain(
                seed.dbMatches.get("NO_BALL").getId(), seed.dashDraftMatch.getId());
    }

    @Test
    void aGeneratedResultCarriesItsRunsWicketsBallsAndRunRatesFromTheRightInnings() {
        TeamDashboardDto d = eagles();
        // i = 13: scheduled 120 balls, Eagles 120 + 13 = 133/3, opposition 100 + 39 = 139/4 off 120 - 6 = 114 balls
        TeamDashboardResult r13 = result(d, "M013");
        assertThat(r13.ownRuns()).isEqualTo(133);
        assertThat(r13.ownWickets()).isEqualTo(3);
        assertThat(r13.ownBalls()).isEqualTo(120);
        assertThat(r13.oppRuns()).isEqualTo(139);
        assertThat(r13.oppWickets()).isEqualTo(4);
        assertThat(r13.oppBalls()).isEqualTo(114);
        assertThat(r13.ownRunRate()).as("133 off 20 overs").isEqualByComparingTo("6.65");
        assertThat(r13.oppRunRate()).as("139 off 19 overs").isEqualByComparingTo("7.32");
        assertThat(r13.forfeit()).isFalse();
        assertThat(r13.derby()).isFalse();
        // i = 20 has eight-ball overs: 140 off 160 balls is 20 overs = 7.00 (not 5.25)
        TeamDashboardResult r20 = result(d, "M020");
        assertThat(r20.ownRuns()).isEqualTo(140);
        assertThat(r20.ownRunRate()).isEqualByComparingTo("7.00");
        // i = 33's opposition: 100 + 99 % 50 = 149 off 120 - 5 = 115 balls = 19.1666 overs
        assertThat(result(d, "M033").oppRunRate()).isEqualByComparingTo("7.77");
        assertThat(result(d, "M013").opponentName()).isEqualTo("Occasionals");
    }

    private TeamDashboardResult result(TeamDashboardDto d, String key) {
        UUID id = seed.dbMatches.get(key).getId();
        return d.results().stream().filter(r -> r.matchId().equals(id)).findFirst()
                .orElseThrow(() -> new AssertionError(key + " is not in the window"));
    }

    @Test
    void aForfeitIsInTheDonutAndAsALabelledGapInTheRunsAndNeverHasExtrasOrDots() {
        TeamDashboardDto d = eagles();
        TeamDashboardResult received = result(d, "FORFEIT_RECEIVED");
        TeamDashboardResult conceded = result(d, "FORFEIT_CONCEDED");

        assertThat(received.result()).isEqualTo("WON");
        assertThat(received.forfeit()).isTrue();
        assertThat(conceded.result()).isEqualTo("LOST");
        assertThat(conceded.forfeit()).isTrue();
        for (TeamDashboardResult r : List.of(received, conceded)) {
            assertThat(r.ownRuns()).as("the stray default innings are never read").isNull();
            assertThat(r.oppRuns()).isNull();
            assertThat(r.ownWickets()).isNull();
            assertThat(r.ownBalls()).isNull();
            assertThat(r.oppBalls()).isNull();
            assertThat(r.ownRunRate()).isNull();
            assertThat(r.oppRunRate()).isNull();
        }
        assertThat(d.resultsSummary().forfeits()).isEqualTo(2);
        List<UUID> forfeitIds = List.of(received.matchId(), conceded.matchId());
        assertThat(d.extrasConceded()).extracting(TeamDashboardExtrasPoint::matchId).doesNotContainAnyElementsOf(forfeitIds);
        assertThat(d.dotBalls()).extracting(TeamDashboardDotBallsPoint::matchId).doesNotContainAnyElementsOf(forfeitIds);
        assertThat(d.runRateTrend()).extracting(p -> p.matchId()).doesNotContainAnyElementsOf(forfeitIds);
    }

    @Test
    void aResultWithNoOppositionInningsHasItsOwnRunsAndNoOppositionFigureOrExtrasOrDotsPoint() {
        TeamDashboardDto d = eagles();
        TeamDashboardResult r = result(d, "NO_OPP");

        assertThat(r.result()).isEqualTo("WON");
        assertThat(r.ownRuns()).isEqualTo(130);
        assertThat(r.ownWickets()).isEqualTo(4);
        assertThat(r.oppRuns()).isNull();
        assertThat(r.oppBalls()).isNull();
        assertThat(r.oppRunRate()).isNull();
        assertThat(r.ownRunRate()).isEqualByComparingTo("6.50");
        UUID id = r.matchId();
        assertThat(d.extrasConceded()).extracting(TeamDashboardExtrasPoint::matchId).doesNotContain(id);
        assertThat(d.dotBalls()).extracting(TeamDashboardDotBallsPoint::matchId).doesNotContain(id);
        assertThat(d.resultsSummary().withRuns()).as("a result with runs on both sides").isLessThan(d.resultsSummary().shown());
    }

    @Test
    void aDerbyGivesEachTeamItsOwnResultWithTheOtherTeamAsTheOpponent() {
        TeamDashboardDto eagles = eagles();
        TeamDashboardResult home = result(eagles, "DERBY");
        assertThat(home.derby()).isTrue();
        assertThat(home.result()).isEqualTo("WON");
        assertThat(home.opponentName()).isEqualTo("DB Rooks");
        assertThat(home.ownRuns()).isEqualTo(150);
        assertThat(home.oppRuns()).isEqualTo(130);

        TeamDashboardDto rooks = service.get(admin, clubId, seed.dbRooks.getId(), null, null, null);
        assertThat(rooks.results()).hasSize(1);
        TeamDashboardResult away = rooks.results().get(0);
        assertThat(away.matchId()).isEqualTo(home.matchId());
        assertThat(away.derby()).isTrue();
        assertThat(away.result()).isEqualTo("LOST");
        assertThat(away.opponentName()).isEqualTo("DB Eagles");
        assertThat(away.ownRuns()).isEqualTo(130);
        assertThat(away.oppRuns()).isEqualTo(150);
        // the Rooks bowled in the first innings: their extras are the first innings' (3 wides), not the Eagles' (7)
        assertThat(rooks.extrasConceded()).singleElement().satisfies(p -> {
            assertThat(p.wides()).isEqualTo(3);
            assertThat(p.noBalls()).isNull();
            assertThat(p.total()).isEqualTo(3);
            assertThat(p.derby()).isTrue();
        });
        assertThat(result(eagles, "DERBY").derby()).isTrue();
        assertThat(extras(eagles, "DERBY").wides()).isEqualTo(4);
        assertThat(extras(eagles, "DERBY").total()).isEqualTo(7);
        // dots: each team's own bowler rows only (Dee, 4 of 12 for the Eagles and 2 of 6 for the Rooks)
        assertThat(dots(eagles, "DERBY").dots()).isEqualTo(4);
        assertThat(dots(eagles, "DERBY").ballsBowled()).isEqualTo(12);
        assertThat(rooks.dotBalls()).singleElement().satisfies(p -> {
            assertThat(p.dots()).isEqualTo(2);
            assertThat(p.ballsBowled()).isEqualTo(6);
            assertThat(p.dotPercent()).isEqualByComparingTo("33.3");
        });
    }

    @Test
    void aFreeTextOpponentIsNamedAndTheDerbyOpponentIsTheClubTeam() {
        TeamDashboardDto d = eagles();
        // i = 8 is outside the 30-result window of the whole history; the season 1 league 1 scope holds 30 results
        TeamDashboardDto s1 = service.get(admin, clubId, seed.dbEagles.getId(), seed.s1.getId(), seed.l1.getId(), null);
        UUID m8 = seed.dbMatches.get("M008").getId();
        assertThat(s1.results().stream().filter(r -> r.matchId().equals(m8)).findFirst().orElseThrow().opponentName())
                .isEqualTo("Late Visitors");
        assertThat(d.results().stream().map(TeamDashboardResult::opponentName).distinct().toList())
                .containsExactlyInAnyOrder("Occasionals", "DB Rooks");
    }

    // ---- run rate and net run rate ----

    @Test
    void theRunRateTrendIsRunningTeamAndOppositionRatesOverEveryResultWithBalls() {
        TeamDashboardDto d = eagles();

        // 40 results with balls on at least one side (not the forfeits); the first is M001: 121 off 20 overs, 103 off 19.8333
        assertThat(d.runRateTrend()).hasSize(40);
        var first = d.runRateTrend().get(0);
        assertThat(first.matchId()).isEqualTo(seed.dbMatches.get("M001").getId());
        assertThat(first.teamRunRate()).isEqualByComparingTo("6.05");
        assertThat(first.oppositionRunRate()).isEqualByComparingTo("5.19");
        // the NO_OPP result adds only the team side: the last point is the page's Team run rate
        assertThat(d.runRateTrend().get(39).matchId()).isEqualTo(seed.dbMatches.get("NO_OPP").getId());
    }

    @Test
    void netRunRateIsOnlyDrawnWhenTheScopeIsOneCompetition() {
        TeamDashboardDto all = eagles();
        assertThat(all.netRunRateTrend().status()).isEqualTo("NOT_ONE_COMPETITION");
        assertThat(all.netRunRateTrend().points()).isEmpty();

        TeamDashboardDto one = service.get(admin, clubId, seed.dbEagles.getId(), seed.s1.getId(), seed.l1.getId(), null);
        assertThat(one.netRunRateTrend().status()).isEqualTo("SHOWN");
        assertThat(one.netRunRateTrend().points()).isNotEmpty();
        assertThat(one.netRunRateTrend().points().get(0).value()).isNotNull();
    }

    // ---- extras ----

    private TeamDashboardExtrasPoint extras(TeamDashboardDto d, String key) {
        UUID id = seed.dbMatches.get(key).getId();
        return d.extrasConceded().stream().filter(p -> p.matchId().equals(id)).findFirst()
                .orElseThrow(() -> new AssertionError(key + " has no extras point"));
    }

    @Test
    void extrasPointsAreItemisedPartlyItemisedTotalOnlyOrAGapAndNullIsNeverZero() {
        TeamDashboardDto d = eagles();

        // 39 results have an opposition innings; the last thirty are M010..M036, OVER1, OVER2, DERBY
        assertThat(d.extrasConceded()).hasSize(30);
        assertThat(d.extrasConceded().get(0).matchId()).isEqualTo(seed.dbMatches.get("M010").getId());
        assertThat(d.extrasConceded().get(29).matchId()).isEqualTo(seed.dbMatches.get("DERBY").getId());

        TeamDashboardExtrasPoint itemised = extras(d, "M013"); // 13 % 4 = 1: 12 = 5 + 2 + 3 + 2 + 0
        assertThat(itemised.itemised()).isTrue();
        assertThat(itemised.wides()).isEqualTo(5);
        assertThat(itemised.noBalls()).isEqualTo(2);
        assertThat(itemised.byes()).isEqualTo(3);
        assertThat(itemised.legByes()).isEqualTo(2);
        assertThat(itemised.penaltyRuns()).as("a recorded zero is a real zero").isEqualTo(0);
        assertThat(itemised.total()).isEqualTo(12);
        assertThat(itemised.notItemised()).isNull();

        TeamDashboardExtrasPoint partly = extras(d, "M014"); // 14 % 4 = 2: wides 4 and byes 2 recorded, the rest blank
        assertThat(partly.itemised()).isTrue();
        assertThat(partly.wides()).isEqualTo(4);
        assertThat(partly.byes()).isEqualTo(2);
        assertThat(partly.noBalls()).as("not recorded is null, never 0").isNull();
        assertThat(partly.legByes()).isNull();
        assertThat(partly.penaltyRuns()).isNull();
        assertThat(partly.total()).isEqualTo(6);
        assertThat(partly.notItemised()).isNull();

        TeamDashboardExtrasPoint totalOnly = extras(d, "M015"); // 15 % 4 = 3: a total of 9 and no component
        assertThat(totalOnly.itemised()).isFalse();
        assertThat(totalOnly.wides()).isNull();
        assertThat(totalOnly.byes()).isNull();
        assertThat(totalOnly.total()).isEqualTo(9);
        assertThat(totalOnly.notItemised()).isEqualTo(9);

        TeamDashboardExtrasPoint none = extras(d, "M012"); // 12 % 4 = 0: nothing recorded: a gap
        assertThat(none.itemised()).isFalse();
        assertThat(none.total()).isNull();
        assertThat(none.notItemised()).isNull();
        assertThat(none.wides()).isNull();
        assertThat(extras(d, "OVER1").total()).isNull();

        // the summary counts over the 30 in the window
        List<String> window = new ArrayList<>(last(keys().stream().filter(k -> !k.startsWith("FORFEIT") && !k.equals("NO_OPP")).toList(), 30));
        long withExtras = window.stream().filter(k -> k.equals("DERBY") || (k.startsWith("M") && index(k) % 4 != 0)).count();
        long itemisedCount = window.stream().filter(k -> k.equals("DERBY") || (k.startsWith("M") && (index(k) % 4 == 1 || index(k) % 4 == 2))).count();
        var sum = d.extrasSummary();
        assertThat(sum.matchesCounted()).isEqualTo(30);
        assertThat(sum.totalPoints()).isEqualTo(39);
        assertThat(sum.shown()).isEqualTo(30);
        assertThat(sum.matchesWithExtras()).isEqualTo(withExtras);
        assertThat(sum.matchesItemised()).isEqualTo(itemisedCount);
        assertThat(sum.widesRecorded()).isEqualTo(itemisedCount);
        assertThat(sum.noBallsRecorded()).isEqualTo(window.stream().filter(k -> k.equals("DERBY") || (k.startsWith("M") && index(k) % 4 == 1)).count());
    }

    // ---- dot balls ----

    private TeamDashboardDotBallsPoint dots(TeamDashboardDto d, String key) {
        UUID id = seed.dbMatches.get(key).getId();
        return d.dotBalls().stream().filter(p -> p.matchId().equals(id)).findFirst()
                .orElseThrow(() -> new AssertionError(key + " has no dot-balls point"));
    }

    @Test
    void dotsAreChartedOnlyWhenEveryBowlerWhoBowledRecordedThem() {
        TeamDashboardDto d = eagles();

        assertThat(d.dotBalls()).hasSize(30);
        // M012 (even): Dash alone, 12 balls, dots 3 + 12 % 4 = 3
        assertThat(dots(d, "M012").ballsBowled()).isEqualTo(12);
        assertThat(dots(d, "M012").dots()).isEqualTo(3);
        assertThat(dots(d, "M012").dotPercent()).isEqualByComparingTo("25.0");
        // M013 (odd): Dash's dots are not recorded, so none for the match (a gap, never a partial sum)
        assertThat(dots(d, "M013").ballsBowled()).isEqualTo(12);
        assertThat(dots(d, "M013").dots()).isNull();
        assertThat(dots(d, "M013").dotPercent()).isNull();
        // M014: Dash's row has 0 balls and no dots, so there is nothing to record: 0 balls, no percent
        assertThat(dots(d, "M014").ballsBowled()).isEqualTo(0);
        assertThat(dots(d, "M014").dotPercent()).isNull();
        // M020: Dash 16 balls (eight-ball overs) dots 3, Mate 6 balls dots 2: 5 of 22 balls = 22.7
        assertThat(dots(d, "M020").ballsBowled()).isEqualTo(22);
        assertThat(dots(d, "M020").dots()).isEqualTo(5);
        assertThat(dots(d, "M020").dotPercent()).isEqualByComparingTo("22.7");
        // M021: Dash has no dots (odd), Mate recorded: one blank bowler row blocks the match
        assertThat(dots(d, "M021").dots()).isNull();
        // M024: only Mate bowled (6 balls, 2 dots)
        assertThat(dots(d, "M024").ballsBowled()).isEqualTo(6);
        assertThat(dots(d, "M024").dotPercent()).isEqualByComparingTo("33.3");
        // M026: Dash recorded dots, Mate (6 balls) did not: null
        assertThat(dots(d, "M026").dots()).isNull();
        // M030: Mate's 0-ball row does not block the rule: Dash 18 balls, dots 3 + 2 = 5
        assertThat(dots(d, "M030").ballsBowled()).isEqualTo(18);
        assertThat(dots(d, "M030").dots()).isEqualTo(5);
        assertThat(dots(d, "M030").dotPercent()).isEqualByComparingTo("27.8");
    }

    @Test
    void theDotAverageIsPooledOverTheChartedMatchesNotTheMeanOfThePercentages_andHasATrendHint() {
        TeamDashboardDto d = eagles();
        List<TeamDashboardDotBallsPoint> charted = d.dotBalls().stream().filter(p -> p.dotPercent() != null).toList();
        long dots = charted.stream().mapToLong(TeamDashboardDotBallsPoint::dots).sum();
        long balls = charted.stream().mapToLong(TeamDashboardDotBallsPoint::ballsBowled).sum();
        BigDecimal mean = charted.stream().map(TeamDashboardDotBallsPoint::dotPercent).reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(charted.size()), 1, RoundingMode.HALF_UP);
        BigDecimal pooled = BigDecimal.valueOf(dots * 100).divide(BigDecimal.valueOf(balls), 1, RoundingMode.HALF_UP);

        var s = d.dotBallsSummary();
        assertThat(charted).isNotEmpty();
        assertThat(s.matchesWithDots()).isEqualTo(charted.size());
        assertThat(s.matchesCounted()).isEqualTo(30);
        assertThat(s.totalPoints()).isEqualTo(39);
        assertThat(s.averageDotPercent()).isEqualByComparingTo(pooled);
        assertThat(pooled).as("the fixture separates pooled from the mean").isNotEqualByComparingTo(mean);

        // trend: pooled dots over balls of the last five charted matches against the five before
        BigDecimal recent = pool(last(charted, 5));
        BigDecimal earlier = pool(charted.subList(charted.size() - 10, charted.size() - 5));
        assertThat(s.recentAverage()).isEqualByComparingTo(recent);
        assertThat(s.earlierAverage()).isEqualByComparingTo(earlier);
        String direction = recent.subtract(earlier).abs().compareTo(new BigDecimal("0.5")) <= 0
                ? "FLAT" : recent.compareTo(earlier) > 0 ? "UP" : "DOWN";
        assertThat(s.direction()).isEqualTo(direction);
    }

    private static BigDecimal pool(List<TeamDashboardDotBallsPoint> points) {
        long dots = points.stream().mapToLong(TeamDashboardDotBallsPoint::dots).sum();
        long balls = points.stream().mapToLong(TeamDashboardDotBallsPoint::ballsBowled).sum();
        return BigDecimal.valueOf(dots * 100).divide(BigDecimal.valueOf(balls), 1, RoundingMode.HALF_UP);
    }

    @Test
    void noTrendSentenceWhenFewerThanThreeMatchesAreChartedInAHalf() {
        // season 2 friendlies: M011, M012, M023, M024, M035, M036: at most six matches, so no half of three after the last five
        TeamDashboardDto d = service.get(admin, clubId, seed.dbEagles.getId(), seed.s2.getId(), null, "FRIENDLY");

        assertThat(d.dotBallsSummary().recentAverage()).isNull();
        assertThat(d.dotBallsSummary().earlierAverage()).isNull();
        assertThat(d.dotBallsSummary().direction()).isNull();
    }

    // ---- published only, filters ----

    @Test
    void unpublishingAResultTakesItOutOfEverySeriesOnTheNextRead() {
        TeamDashboardDto before = eagles();
        assertThat(before.results().get(29).matchId()).isEqualTo(seed.dbMatches.get("NO_OPP").getId());
        UUID m36 = seed.dashUnpublishMatch.getId();
        assertThat(before.results()).extracting(TeamDashboardResult::matchId).contains(m36);

        seed.setStatus(seed.dashUnpublishMatch, "DRAFT");
        TeamDashboardDto after = eagles();

        assertThat(after.resultsSummary().played()).isEqualTo(41);
        assertThat(after.results()).extracting(TeamDashboardResult::matchId).doesNotContain(m36);
        assertThat(after.extrasConceded()).extracting(TeamDashboardExtrasPoint::matchId).doesNotContain(m36);
        assertThat(after.dotBalls()).extracting(TeamDashboardDotBallsPoint::matchId).doesNotContain(m36);
        assertThat(after.runRateTrend()).extracting(p -> p.matchId()).doesNotContain(m36);
    }

    @Test
    void eachFilterNarrowsEverySeriesToTheMatchingResults() {
        record Case(String name, UUID season, UUID league, String competition, Predicate<String> expected) {
        }
        // every special result is in season 1 and league 1; the generated ones follow the phase of the index
        Predicate<String> l1 = k -> !k.startsWith("M") || (index(k) - 1) % 12 < 8;
        Predicate<String> l2 = k -> k.startsWith("M") && (index(k) - 1) % 12 >= 8 && (index(k) - 1) % 12 < 10;
        Predicate<String> friendly = k -> k.startsWith("M") && (index(k) - 1) % 12 >= 10;
        List<Case> cases = List.of(
                new Case("all", null, null, null, k -> true),
                new Case("season 1", seed.s1.getId(), null, null, k -> !friendly.test(k)),
                new Case("season 2", seed.s2.getId(), null, null, friendly),
                new Case("league 1", null, seed.l1.getId(), null, l1),
                new Case("league 2", null, seed.l2.getId(), null, l2),
                new Case("league games", null, null, "LEAGUE", k -> !friendly.test(k)),
                new Case("friendlies", null, null, "FRIENDLY", friendly),
                new Case("season 1, league 1", seed.s1.getId(), seed.l1.getId(), null, l1));
        for (Case c : cases) {
            TeamDashboardDto d = service.get(admin, clubId, seed.dbEagles.getId(), c.season(), c.league(), c.competition());
            List<String> expected = keys().stream().filter(c.expected()).toList();
            assertThat(d.resultsSummary().played()).as(c.name()).isEqualTo(expected.size());
            assertThat(d.results()).as(c.name()).extracting(TeamDashboardResult::matchId)
                    .containsExactlyElementsOf(last(expected, 30).stream().map(k -> seed.dbMatches.get(k).getId()).toList());
            assertThat(d.scope().seasonId()).isEqualTo(c.season());
            assertThat(d.scope().competition()).isEqualTo(c.competition());
        }
    }

    // ---- empty, tenancy, cap ----

    @Test
    void aTeamWithNothingCountedIsA200WithEmptySeriesAndNoFigureInvented() {
        TeamDashboardDto d = service.get(admin, clubId, seed.fixtures.team(seed.w.club(), seed.w.juniors(), "No matches").getId(), null, null, null);

        assertThat(d.results()).isEmpty();
        assertThat(d.runRateTrend()).isEmpty();
        assertThat(d.extrasConceded()).isEmpty();
        assertThat(d.dotBalls()).isEmpty();
        assertThat(d.resultsSummary().played()).isZero();
        assertThat(d.resultsSummary().wonPercent()).isNull();
        assertThat(d.resultsSummary().noResultPercent()).isNull();
        assertThat(d.dotBallsSummary().averageDotPercent()).isNull();
        assertThat(d.dotBallsSummary().direction()).isNull();
        assertThat(d.netRunRateTrend().points()).isEmpty();
        assertThat(d.truncated()).isFalse();
        assertThat(d.notCaptured()).isNotNull();
    }

    @Test
    void anUnknownOrAnotherClubsTeamSeasonOrLeagueIsNotFound() {
        UUID team = seed.dbEagles.getId();
        assertThatThrownBy(() -> service.get(admin, clubId, UUID.randomUUID(), null, null, null)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.get(admin, clubId, seed.other.seniors1().getId(), null, null, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.get(admin, clubId, team, seed.other.season().getId(), null, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.get(admin, clubId, team, null, UUID.randomUUID(), null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.get(admin, seed.other.club().getId(), team, null, null, null))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void aScopeOverTheHistoryCapCoversTheNewestThreeHundredResultsAndSaysWhereItStarts() {
        big = new PlayerStatsSeed(context);
        big.seedDashboard(305);
        UUID club = big.w.club().getId();

        TeamDashboardDto d = service.get(admin, club, big.dbEagles.getId(), null, null, null);

        assertThat(keys(big)).hasSize(311);
        assertThat(d.truncated()).isTrue();
        assertThat(d.truncatedSince()).as("311 results, the 300 newest start at M012")
                .isEqualTo(big.dbMatches.get("M012").getMatchDate());
        assertThat(d.basis().resultsCounted()).as("the basis is the whole scope").isEqualTo(311);
        assertThat(d.resultsSummary().played()).isEqualTo(300);
        assertThat(d.resultsSummary().totalPoints()).isEqualTo(300);
        assertThat(d.results()).hasSize(30);
        assertThat(d.results().get(0).matchId()).isEqualTo(big.dbMatches.get(last(keys(big), 30).get(0)).getId());
        assertThat(d.runRateTrend()).hasSizeGreaterThan(250);
        assertThat(d.extrasConceded()).hasSize(30);
        assertThat(d.dotBalls()).hasSize(30);
    }
}
