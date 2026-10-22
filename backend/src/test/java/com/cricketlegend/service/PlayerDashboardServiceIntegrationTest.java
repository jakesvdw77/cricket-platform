package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.dto.PlayerDashboardDto;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardBowlingMatch;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardDismissal;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardWicketType;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.support.PlayerStatsSeed;
import com.cricketlegend.support.PlayerStatsSeed.DashMatch;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
 * docs/specs/117-stats-dashboard.md, "Backend integration": the player Dashboard series for the {@link PlayerStatsSeed}
 * Dashboard scenarios, checked against what the seed was built with (its own {@code DashMatch} oracle, not the code under
 * test). The parity with the tab figures is in {@code PlayerDashboardParityIntegrationTest}. Not {@code @Transactional}.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class PlayerDashboardServiceIntegrationTest {

    private static final int N = 36;

    @Autowired
    private PlayerDashboardService service;

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

    private PlayerDashboardDto get(UUID player, UUID season, UUID league, UUID team, UUID section, String competition) {
        return service.get(admin, clubId, player, season, league, team, section, competition);
    }

    /** dash in the Eagles matches. */
    private PlayerDashboardDto eagles() {
        return get(seed.dash.getId(), null, null, seed.dbEagles.getId(), null, null);
    }

    private List<DashMatch> oracle(Predicate<DashMatch> filter) {
        return seed.dashMatches.stream().filter(filter).toList();
    }

    private static BigDecimal pct(long part, long total) {
        return total <= 0 ? null : BigDecimal.valueOf(part * 100).divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP);
    }

    private static boolean notOut(String howOut) {
        return "NOT_OUT".equals(howOut) || "RETIRED_NOT_OUT".equals(howOut);
    }

    private static <T> List<T> last(List<T> list, int n) {
        return list.subList(Math.max(0, list.size() - n), list.size());
    }

    // ---- batting ----

    @Test
    void battingSeriesAreTheSeedsInnings_oldestFirst_windowedToThirty_andNeverPlotAMissingCardAsZero() {
        PlayerDashboardDto d = eagles();
        List<DashMatch> batted = oracle(m -> m.onEagles() && m.runs() != null);

        assertThat(d.window().pointLimit()).isEqualTo(30);
        assertThat(d.window().historyCap()).isEqualTo(300);
        assertThat(d.truncated()).isFalse();
        assertThat(d.truncatedSince()).isNull();
        assertThat(d.scope().kind()).isEqualTo("CLUB_VERIFIED");
        assertThat(d.basis().matchesCounted()).as("every Eagles match; forfeit, draft and no-ball result never").isEqualTo(N);
        assertThat(d.basis().resultsWithBattingCard()).isEqualTo(N - 2L); // i = 7 and 19 have no batting card; i = 4 did not bat
        assertThat(batted).as("33 batted: 36 less no card (2) and did not bat (1)").hasSize(33);

        // the last thirty innings, oldest first, each the seed's figure
        assertThat(d.battingInnings()).hasSize(30);
        List<DashMatch> windowed = last(batted, 30);
        for (int k = 0; k < 30; k++) {
            var point = d.battingInnings().get(k);
            DashMatch m = windowed.get(k);
            assertThat(point.matchId()).as("order " + k).isEqualTo(m.match().getId());
            assertThat(point.runs()).isEqualTo(m.runs());
            assertThat(point.howOut()).isEqualTo(m.howOut());
            assertThat(point.notOut()).isEqualTo(notOut(m.howOut()));
            assertThat(point.derby()).isFalse();
            assertThat(point.opponentName()).isEqualTo(m.index() == 8 ? "Late Visitors" : "Occasionals");
            if (m.index() == 15) {
                assertThat(point.balls()).as("0 balls and runs scored: not valid, never 0").isNull();
            } else {
                assertThat(point.balls()).isEqualTo(m.balls());
            }
        }
        assertThat(d.battingInnings()).extracting(p -> p.matchId()).doesNotContain(
                seed.dbMatches.get("FORFEIT_RECEIVED").getId(), seed.dashDraftMatch.getId(),
                seed.dashMatches.get(6).match().getId() /* i = 7, no batting card */);
        assertThat(d.battingInnings()).extracting(p -> p.runs()).doesNotContain(99, 200);

        long runs = batted.stream().mapToLong(DashMatch::runs).sum();
        long notOuts = batted.stream().filter(m -> notOut(m.howOut())).count();
        assertThat(d.battingSummary().inningsTotal()).isEqualTo(33);
        assertThat(d.battingSummary().shown()).isEqualTo(30);
        assertThat(d.battingSummary().runs()).isEqualTo(runs);
        assertThat(d.battingSummary().notOuts()).isEqualTo(notOuts);
        assertThat(d.battingSummary().averageRuns())
                .isEqualByComparingTo(BigDecimal.valueOf(runs).divide(BigDecimal.valueOf(33 - notOuts), 2, RoundingMode.HALF_UP));
    }

    @Test
    void theBattingTrendIsTheRunningAverageOverEveryInnings_nullUntilTheFirstDismissal() {
        PlayerDashboardDto d = eagles();
        List<DashMatch> batted = oracle(m -> m.onEagles() && m.runs() != null);

        assertThat(d.battingTrend()).as("every innings, not only the window").hasSize(33);
        long runs = 0;
        long dismissals = 0;
        for (int k = 0; k < batted.size(); k++) {
            DashMatch m = batted.get(k);
            runs += m.runs();
            dismissals += notOut(m.howOut()) ? 0 : 1;
            var point = d.battingTrend().get(k);
            assertThat(point.matchId()).isEqualTo(m.match().getId());
            assertThat(point.cumulativeRuns()).isEqualTo(runs);
            assertThat(point.cumulativeDismissals()).isEqualTo(dismissals);
            if (dismissals == 0) {
                assertThat(point.average()).as("not-outs raise runs without the denominator").isNull();
            } else {
                assertThat(point.average()).isEqualByComparingTo(
                        BigDecimal.valueOf(runs).divide(BigDecimal.valueOf(dismissals), 2, RoundingMode.HALF_UP));
            }
        }
    }

    @Test
    void howYouWereDismissedCountsEveryInningsOnce_bothNotOutKindsInOneSlice_andOrderedNotOutFirst() {
        PlayerDashboardDto d = eagles();
        List<DashMatch> batted = oracle(m -> m.onEagles() && m.runs() != null);
        Map<String, Long> expected = new LinkedHashMap<>();
        for (DashMatch m : batted) {
            expected.merge(notOut(m.howOut()) ? "NOT_OUT" : m.howOut(), 1L, Long::sum);
        }

        Map<String, Long> actual = new LinkedHashMap<>();
        d.dismissals().forEach(s -> actual.put(s.type(), s.count()));
        assertThat(actual).containsExactlyInAnyOrderEntriesOf(expected);
        assertThat(d.dismissals().get(0).type()).as("not out first").isEqualTo("NOT_OUT");
        assertThat(d.dismissals().stream().mapToLong(PlayerDashboardDismissal::count).sum()).isEqualTo(batted.size());
        for (PlayerDashboardDismissal slice : d.dismissals()) {
            assertThat(slice.count()).isPositive();
            assertThat(slice.percent()).isEqualByComparingTo(pct(slice.count(), batted.size()));
            assertThat(slice.label()).isNotBlank();
        }
        assertThat(d.dismissals()).extracting(PlayerDashboardDismissal::type).doesNotContain("DID_NOT_BAT");
    }

    // ---- bowling ----

    @Test
    void bowlingMatchesAreTheMatchesBowledInOrder_withEachMatchsEconomy_andAZeroBallRowIsAGapNeverZero() {
        PlayerDashboardDto d = eagles();
        List<DashMatch> bowled = oracle(m -> m.onEagles() && m.bowled());

        assertThat(bowled).as("every match but i%8 = 0").hasSize(32);
        assertThat(d.bowlingMatches()).hasSize(30);
        List<DashMatch> windowed = last(bowled, 30);
        for (int k = 0; k < 30; k++) {
            PlayerDashboardBowlingMatch p = d.bowlingMatches().get(k);
            DashMatch m = windowed.get(k);
            assertThat(p.matchId()).isEqualTo(m.match().getId());
            assertThat(p.balls()).isEqualTo(m.bowlBalls());
            assertThat(p.runs()).isEqualTo(m.bowlRuns());
            assertThat(p.wickets()).isEqualTo(m.wickets());
            assertThat(p.ballsPerOver()).isEqualTo(m.ballsPerOver());
            if (m.bowlBalls() == 0) {
                assertThat(p.economy()).as("i = 14: 0 balls, 2 runs").isNull();
            } else {
                BigDecimal overs = BigDecimal.valueOf(m.bowlBalls()).divide(BigDecimal.valueOf(m.ballsPerOver()), 20, RoundingMode.HALF_UP);
                assertThat(p.economy()).isEqualByComparingTo(
                        BigDecimal.valueOf(m.bowlRuns()).divide(overs, 2, RoundingMode.HALF_UP));
            }
        }
        // hand-computed: i = 1 is 11 runs off 12 balls = 5.50; i = 10 is 11 off 18 balls = 3.67; i = 20 is 14 off 16 balls
        // of eight-ball overs (two overs) = 7.00, not 14 / (16 / 6) = 5.25
        assertThat(economyOf(d, 10)).isEqualByComparingTo("3.67");
        assertThat(economyOf(d, 20)).isEqualByComparingTo("7.00");
        assertThat(d.bowlingMatches().stream().filter(p -> p.ballsPerOver() == 8)).hasSize(1);
        assertThat(d.economySummary().matchesCounted()).isEqualTo(30);
        assertThat(d.economySummary().matchesWithEconomy()).as("the zero-ball row of i = 14 has none").isEqualTo(29);
        assertThat(d.economySummary().totalPoints()).isEqualTo(32);
        assertThat(d.economySummary().shown()).isEqualTo(30);
    }

    private BigDecimal economyOf(PlayerDashboardDto d, int index) {
        UUID id = seed.dashMatches.get(index - 1).match().getId();
        return d.bowlingMatches().stream().filter(p -> p.matchId().equals(id)).findFirst().orElseThrow().economy();
    }

    @Test
    void theEconomyReferenceIsSumRunsOverSumOversOfTheWholeScope_notTheMeanOfTheMatchFigures_andTheTrendIsPooled() {
        PlayerDashboardDto d = eagles();
        List<DashMatch> bowled = oracle(m -> m.onEagles() && m.bowled());

        BigDecimal runs = BigDecimal.ZERO;
        BigDecimal overs = BigDecimal.ZERO;
        BigDecimal sumOfEconomies = BigDecimal.ZERO;
        int withEconomy = 0;
        for (DashMatch m : bowled) {
            runs = runs.add(BigDecimal.valueOf(m.bowlRuns()));
            if (m.bowlBalls() > 0) {
                BigDecimal o = BigDecimal.valueOf(m.bowlBalls()).divide(BigDecimal.valueOf(m.ballsPerOver()), 30, RoundingMode.HALF_UP);
                overs = overs.add(o);
                sumOfEconomies = sumOfEconomies.add(BigDecimal.valueOf(m.bowlRuns()).divide(o, 2, RoundingMode.HALF_UP));
                withEconomy++;
            }
        }
        BigDecimal overall = runs.divide(overs, 2, RoundingMode.HALF_UP);
        BigDecimal mean = sumOfEconomies.divide(BigDecimal.valueOf(withEconomy), 2, RoundingMode.HALF_UP);

        assertThat(d.economySummary().overallEconomy()).isEqualByComparingTo(overall);
        assertThat(overall).as("the fixture separates the two definitions").isNotEqualByComparingTo(mean);
        // the reference line is over the whole scope even though only 30 matches are drawn
        assertThat(d.economySummary().totalPoints()).isGreaterThan(d.economySummary().shown());

        // trend: pooled economy of the last five matches with economy against the five before
        List<DashMatch> usable = bowled.stream().filter(m -> m.bowlBalls() > 0).toList();
        BigDecimal recent = pooledEconomy(last(usable, 5));
        BigDecimal earlier = pooledEconomy(usable.subList(usable.size() - 10, usable.size() - 5));
        assertThat(d.economySummary().recentEconomy()).isEqualByComparingTo(recent);
        assertThat(d.economySummary().earlierEconomy()).isEqualByComparingTo(earlier);
        String direction = recent.subtract(earlier).abs().compareTo(new BigDecimal("0.25")) <= 0
                ? "FLAT" : recent.compareTo(earlier) > 0 ? "UP" : "DOWN";
        assertThat(d.economySummary().direction()).isEqualTo(direction);
    }

    private static BigDecimal pooledEconomy(List<DashMatch> matches) {
        BigDecimal runs = BigDecimal.ZERO;
        BigDecimal overs = BigDecimal.ZERO;
        for (DashMatch m : matches) {
            runs = runs.add(BigDecimal.valueOf(m.bowlRuns()));
            overs = overs.add(BigDecimal.valueOf(m.bowlBalls()).divide(BigDecimal.valueOf(m.ballsPerOver()), 30, RoundingMode.HALF_UP));
        }
        return runs.divide(overs, 2, RoundingMode.HALF_UP);
    }

    @Test
    void noTrendSentenceBelowThreeMatchesWithEconomyInEachHalf() {
        // season 2 only: the phase 10-11 matches (i = 11, 12, 23, 24, 35, 36): five bowled, fewer than 3 per half
        PlayerDashboardDto d = get(seed.dash.getId(), seed.s2.getId(), null, seed.dbEagles.getId(), null, null);
        assertThat(d.economySummary().totalPoints()).isLessThan(10);
        assertThat(d.economySummary().recentEconomy()).isNull();
        assertThat(d.economySummary().earlierEconomy()).isNull();
        assertThat(d.economySummary().direction()).isNull();
        assertThat(d.economySummary().overallEconomy()).as("the reference line is still there").isNotNull();
    }

    // ---- wickets by type ----

    @Test
    void wicketsByTypeFollowTheCreditedDismissalsAndAlwaysAddUpToTheStoredWickets() {
        PlayerDashboardDto d = eagles();
        List<DashMatch> bowled = oracle(m -> m.onEagles() && m.bowled());
        Map<String, Long> expected = new LinkedHashMap<>();
        long total = 0;
        long notItemised = 0;
        long itemisedInnings = 0;
        long inningsWithWickets = 0;
        for (DashMatch m : bowled) {
            total += m.wickets();
            notItemised += m.notItemised();
            m.types().forEach((t, c) -> expected.merge(t, c, Long::sum));
            itemisedInnings += m.types().isEmpty() ? 0 : 1;
            inningsWithWickets += m.wickets() > 0 ? 1 : 0;
        }
        var wt = d.wicketTypes();

        assertThat(wt.total()).isEqualTo(total);
        assertThat(wt.total()).as("types + not itemised = the wickets").isEqualTo(wt.itemised() + wt.notItemised().count());
        assertThat(wt.notItemised().count()).isEqualTo(notItemised);
        assertThat(wt.types()).extracting(PlayerDashboardWicketType::type).containsExactly(
                "BOWLED", "CAUGHT", "CAUGHT_AND_BOWLED", "LBW", "STUMPED", "HIT_WICKET");
        for (PlayerDashboardWicketType t : wt.types()) {
            assertThat(t.count()).as(t.type()).isEqualTo(expected.getOrDefault(t.type(), 0L));
            assertThat(t.percent()).isEqualByComparingTo(pct(t.count(), total));
        }
        assertThat(wt.notItemised().percent()).isEqualByComparingTo(pct(notItemised, total));
        assertThat(wt.coverage().wicketsTotal()).isEqualTo(total);
        assertThat(wt.coverage().wicketsItemised()).isEqualTo(wt.itemised());
        assertThat(wt.coverage().inningsItemised()).isEqualTo(itemisedInnings);
        assertThat(wt.coverage().inningsWithWickets()).isEqualTo(inningsWithWickets);
        // run-outs that name the bowler (i%4 = 3), the blank-bowler dismissal (i = 13) and the card-less innings (i = 11)
        // are never types
        assertThat(wt.types()).extracting(PlayerDashboardWicketType::type).doesNotContain("RUN_OUT");
        assertThat(wt.notItemised().count()).isGreaterThanOrEqualTo(3 /* i = 11 */ + 1 /* i = 13 */);
    }

    @Test
    void whenTheCreditedDismissalsExceedTheStoredWicketsTheWholeInningsIsNotItemised() {
        PlayerDashboardDto d = get(seed.over.getId(), null, null, null, null, null);
        var wt = d.wicketTypes();

        // OVER1: MANUAL 2 wickets with 3 credited (BOWLED, BOWLED, CAUGHT) -> all 2 not itemised; OVER2: 1 wicket, BOWLED
        assertThat(wt.total()).isEqualTo(3);
        assertThat(wt.notItemised().count()).isEqualTo(2);
        assertThat(wt.itemised()).isEqualTo(1);
        assertThat(wt.types().stream().filter(t -> t.count() > 0)).extracting(PlayerDashboardWicketType::type)
                .containsExactly("BOWLED");
        assertThat(wt.types().get(0).count()).isEqualTo(1);
        assertThat(wt.coverage().inningsWithWickets()).isEqualTo(2);
        assertThat(wt.coverage().inningsItemised()).isEqualTo(1);
    }

    // ---- derby, forfeit, other kinds ----

    @Test
    void aDerbyIsOneMatchWithBothSidesCombined_andATeamFilterKeepsOnlyThatSide() {
        PlayerDashboardDto both = get(seed.dee.getId(), null, null, null, null, null);
        assertThat(both.basis().matchesCounted()).isEqualTo(1);
        assertThat(both.battingInnings()).hasSize(2);
        assertThat(both.battingInnings()).allSatisfy(p -> {
            assertThat(p.derby()).isTrue();
            assertThat(p.opponentName()).as("a derby names no opponent").isNull();
        });
        assertThat(both.battingSummary().runs()).isEqualTo(38);
        assertThat(both.bowlingMatches()).as("one point for the match").hasSize(1);
        PlayerDashboardBowlingMatch bowl = both.bowlingMatches().get(0);
        assertThat(bowl.balls()).isEqualTo(18);
        assertThat(bowl.runs()).isEqualTo(23);
        assertThat(bowl.wickets()).isEqualTo(1);
        assertThat(bowl.economy()).isEqualByComparingTo("7.67");
        assertThat(bowl.derby()).isTrue();

        PlayerDashboardDto home = get(seed.dee.getId(), null, null, seed.dbEagles.getId(), null, null);
        assertThat(home.battingSummary().runs()).isEqualTo(30);
        assertThat(home.bowlingMatches()).singleElement().satisfies(p -> assertThat(p.balls()).isEqualTo(12));
        PlayerDashboardDto away = get(seed.dee.getId(), null, null, seed.dbRooks.getId(), null, null);
        assertThat(away.battingSummary().runs()).isEqualTo(8);
        assertThat(away.bowlingMatches()).singleElement().satisfies(p -> assertThat(p.balls()).isEqualTo(6));
    }

    @Test
    void forfeitsNoBallResultsSuperOversAndDraftsNeverContribute() {
        PlayerDashboardDto d = eagles();
        List<DashMatch> mine = oracle(DashMatch::onEagles);

        // the forfeit (99), the draft (200) and the super-over innings (6 runs, 2 wickets, i = 5) are in no total
        assertThat(d.battingSummary().runs()).isEqualTo(mine.stream().filter(m -> m.runs() != null).mapToLong(DashMatch::runs).sum());
        assertThat(d.battingTrend()).extracting(p -> p.matchId()).doesNotContain(
                seed.dbMatches.get("FORFEIT_RECEIVED").getId(), seed.dashDraftMatch.getId());
        assertThat(d.wicketTypes().total()).isEqualTo(mine.stream().mapToLong(DashMatch::wickets).sum());
        DashMatch five = seed.dashMatches.get(4);
        assertThat(d.battingTrend().stream().filter(p -> p.matchId().equals(five.match().getId()))).hasSize(1);
        assertThat(d.battingInnings().stream().filter(p -> p.matchId().equals(five.match().getId())))
                .as("one regular innings, the super over is a second innings of the same match that is not read")
                .hasSize(1);
    }

    // ---- published only ----

    @Test
    void unpublishingAResultTakesItOutOfEverySeriesOnTheNextRead() {
        PlayerDashboardDto before = eagles();
        DashMatch gone = seed.dashMatches.get(N - 1);
        assertThat(gone.match().getId()).isEqualTo(seed.dashUnpublishMatch.getId());
        assertThat(before.battingTrend().get(before.battingTrend().size() - 1).matchId()).isEqualTo(gone.match().getId());

        seed.setStatus(seed.dashUnpublishMatch, "DRAFT");
        PlayerDashboardDto after = eagles();

        assertThat(after.basis().matchesCounted()).isEqualTo(N - 1L);
        assertThat(after.battingTrend()).hasSize(before.battingTrend().size() - (gone.runs() == null ? 0 : 1));
        assertThat(after.battingTrend()).extracting(p -> p.matchId()).doesNotContain(gone.match().getId());
        assertThat(after.battingSummary().runs()).isEqualTo(before.battingSummary().runs() - (gone.runs() == null ? 0 : gone.runs()));
        assertThat(after.wicketTypes().total()).isEqualTo(before.wicketTypes().total() - gone.wickets());
    }

    // ---- filters ----

    @Test
    void eachFilterAloneAndCombinedNarrowsEverySeriesToTheMatchingMatches() {
        record Case(String name, UUID season, UUID league, UUID team, UUID section, String competition,
                Predicate<DashMatch> expected) {
        }
        List<Case> cases = List.of(
                new Case("all", null, null, null, null, null, m -> true),
                new Case("season 1", seed.s1.getId(), null, null, null, null, m -> m.seasonKey().equals("s1")),
                new Case("season 2", seed.s2.getId(), null, null, null, null, m -> m.seasonKey().equals("s2")),
                new Case("league 1", null, seed.l1.getId(), null, null, null, m -> "l1".equals(m.leagueKey())),
                new Case("league 2", null, seed.l2.getId(), null, null, null, m -> "l2".equals(m.leagueKey())),
                new Case("league games", null, null, null, null, "LEAGUE", m -> m.leagueKey() != null),
                new Case("friendlies", null, null, null, null, "FRIENDLY", m -> m.leagueKey() == null),
                new Case("team Eagles", null, null, seed.dbEagles.getId(), null, null, DashMatch::onEagles),
                new Case("team Seniors 1", null, null, seed.w.seniors1().getId(), null, null, m -> !m.onEagles()),
                new Case("section Seniors A", null, null, null, seed.seniorsA.getId(), null, DashMatch::onEagles),
                new Case("section Seniors", null, null, null, seed.w.seniors().getId(), null, m -> true),
                new Case("section Juniors", null, null, null, seed.w.juniors().getId(), null, m -> false),
                new Case("season 1, league 1, Eagles", seed.s1.getId(), seed.l1.getId(), seed.dbEagles.getId(), null, null,
                        m -> m.onEagles() && m.seasonKey().equals("s1") && "l1".equals(m.leagueKey())),
                new Case("season 2 friendlies", seed.s2.getId(), null, null, null, "FRIENDLY",
                        m -> m.seasonKey().equals("s2") && m.leagueKey() == null));
        int nonEmpty = 0;
        for (Case c : cases) {
            PlayerDashboardDto d = get(seed.dash.getId(), c.season(), c.league(), c.team(), c.section(), c.competition());
            List<DashMatch> expected = oracle(c.expected());
            // the Seniors 1 matches are real matches for a "no filter" read: add them to the match count by their results
            List<DashMatch> batted = expected.stream().filter(m -> m.runs() != null).toList();
            assertThat(d.basis().matchesCounted()).as(c.name() + " matches").isEqualTo(expected.size());
            assertThat(d.battingSummary().inningsTotal()).as(c.name() + " innings").isEqualTo(batted.size());
            assertThat(d.battingSummary().runs()).as(c.name() + " runs").isEqualTo(batted.stream().mapToLong(DashMatch::runs).sum());
            assertThat(d.wicketTypes().total()).as(c.name() + " wickets")
                    .isEqualTo(expected.stream().mapToLong(DashMatch::wickets).sum());
            assertThat(d.scope().seasonId()).isEqualTo(c.season());
            assertThat(d.scope().competition()).isEqualTo(c.competition());
            if (!expected.isEmpty()) {
                nonEmpty++;
            }
        }
        assertThat(nonEmpty).isGreaterThan(10);
    }

    // ---- empty, tenancy ----

    @Test
    void aPlayerWithNothingCountedIsA200WithEmptySeriesAndNoFigureInvented() {
        PlayerDashboardDto d = get(seed.gina.getId(), null, null, null, null, null);

        assertThat(d.playerId()).isEqualTo(seed.gina.getId());
        assertThat(d.basis().matchesCounted()).isZero();
        assertThat(d.battingInnings()).isEmpty();
        assertThat(d.dismissals()).isEmpty();
        assertThat(d.battingTrend()).isEmpty();
        assertThat(d.bowlingMatches()).isEmpty();
        assertThat(d.battingSummary().inningsTotal()).isZero();
        assertThat(d.battingSummary().averageRuns()).isNull();
        assertThat(d.economySummary().overallEconomy()).isNull();
        assertThat(d.economySummary().direction()).isNull();
        assertThat(d.wicketTypes().total()).isZero();
        assertThat(d.wicketTypes().notItemised().percent()).isNull();
        assertThat(d.wicketTypes().types()).hasSize(6).allSatisfy(t -> {
            assertThat(t.count()).isZero();
            assertThat(t.percent()).isNull();
        });
        assertThat(d.truncated()).isFalse();
        assertThat(d.notCaptured()).isNotNull();
    }

    @Test
    void anUnknownOrAnotherClubsPlayerSeasonLeagueTeamOrSectionIsNotFound() {
        UUID player = seed.dash.getId();
        assertThatThrownBy(() -> get(UUID.randomUUID(), null, null, null, null, null)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> get(seed.xavier.getId(), null, null, null, null, null)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> get(player, seed.other.season().getId(), null, null, null, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> get(player, UUID.randomUUID(), null, null, null, null)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> get(player, null, UUID.randomUUID(), null, null, null)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> get(player, null, null, seed.other.seniors1().getId(), null, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> get(player, null, null, null, seed.other.seniors().getId(), null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.get(admin, seed.other.club().getId(), player, null, null, null, null, null))
                .as("the club does not own the player").isInstanceOf(NotFoundException.class);
    }

    // ---- the 300 cap ----

    @Test
    void aScopeOverTheHistoryCapCoversTheNewestThreeHundred_andSaysWhereItStarts() {
        big = new PlayerStatsSeed(context);
        big.seedDashboard(305);
        UUID club = big.w.club().getId();

        PlayerDashboardDto d = service.get(admin, club, big.dash.getId(), null, null, big.dbEagles.getId(), null, null);

        assertThat(d.truncated()).isTrue();
        assertThat(d.truncatedSince()).as("the oldest match covered is the sixth").isEqualTo(big.dashMatches.get(5).match().getMatchDate());
        assertThat(d.basis().matchesCounted()).as("the basis is the whole scope, as the tiles").isEqualTo(305);
        List<DashMatch> covered = big.dashMatches.subList(5, 305);
        long batted = covered.stream().filter(m -> m.runs() != null).count();
        assertThat(d.battingTrend()).hasSize((int) batted);
        assertThat(d.battingSummary().inningsTotal()).isEqualTo(batted);
        assertThat(d.battingInnings()).hasSize(30);
        assertThat(d.bowlingMatches()).hasSize(30);
        assertThat(d.economySummary().totalPoints()).isEqualTo(covered.stream().filter(DashMatch::bowled).count());
        // the economy reference and the batting average are over the whole scope, so the cap does not move them
        List<DashMatch> all = big.dashMatches.subList(0, 305);
        BigDecimal runs = BigDecimal.ZERO;
        BigDecimal overs = BigDecimal.ZERO;
        for (DashMatch m : all) {
            if (m.bowled()) {
                runs = runs.add(BigDecimal.valueOf(m.bowlRuns())); // the zero-ball row of i = 14 still conceded 2 runs
            }
            if (m.bowled() && m.bowlBalls() > 0) {
                overs = overs.add(BigDecimal.valueOf(m.bowlBalls()).divide(BigDecimal.valueOf(m.ballsPerOver()), 30, RoundingMode.HALF_UP));
            }
        }
        assertThat(d.economySummary().overallEconomy()).isEqualByComparingTo(runs.divide(overs, 2, RoundingMode.HALF_UP));
        assertThat(new ArrayList<>(d.battingTrend()).get(0).matchId()).isNotEqualTo(big.dashMatches.get(0).match().getId());
    }
}
