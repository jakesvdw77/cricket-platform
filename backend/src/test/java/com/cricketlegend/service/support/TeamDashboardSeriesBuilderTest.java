package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.dto.TeamDashboardDto;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardDotBallsPoint;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardExtrasPoint;
import com.cricketlegend.dto.TeamDashboardDto.TeamDashboardResult;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsPageBasis;
import com.cricketlegend.dto.TeamStatsDto.TeamStatsPageScope;
import com.cricketlegend.service.support.TeamDashboardSeriesBuilder.ResultFact;
import com.cricketlegend.service.support.TeamStatsCalculator.NrrStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * docs/specs/117-stats-dashboard.md, "Team series" and Test Plan: result letters, runs, run rates, net run rate, extras
 * conceded and dot balls, with the window, the cap and the forfeit rule. The builder shapes facts; every figure is the
 * calculator's.
 */
class TeamDashboardSeriesBuilderTest {

    private static final UUID TEAM = UUID.randomUUID();
    private static final Instant DAY_ONE = Instant.parse("2026-02-01T09:00:00Z");

    /** Mutable fixture row: a won home match with usable innings on both sides unless a test says otherwise. */
    private static final class Fact {
        static int counter = 0;
        final int index = counter++;
        UUID matchId = UUID.randomUUID();
        UUID resultId = UUID.randomUUID();
        Instant date = DAY_ONE.plusSeconds(86_400L * index);
        boolean derby = false;
        String outcome = "WON";
        String winningSide = "HOME";
        String side = "HOME";
        long oppInnings = 1;
        long ownUsable = 1;
        long oppUsable = 1;
        Long ownRuns = 100L;
        Long ownWickets = 5L;
        Long ownBalls = 120L;
        Long ownRunsWithBalls = 100L;
        BigDecimal ownOvers = new BigDecimal("20");
        Long oppRuns = 80L;
        Long oppWickets = 10L;
        Long oppBalls = 120L;
        Long oppRunsWithBalls = 80L;
        BigDecimal oppOvers = new BigDecimal("20");
        Long extras;
        Long wides;
        Long noBalls;
        Long byes;
        Long legByes;
        Long penalty;
        Long bowlBalls;
        Long bowlDots;
        long bowlRows;
        long bowlDotsRows;
        boolean nrrUsable;
        long nrrOwnRuns;
        long nrrOppRuns;
        BigDecimal nrrOwnOvers;
        BigDecimal nrrOppOvers;

        Fact outcome(String outcome, String winningSide, String side) {
            this.outcome = outcome;
            this.winningSide = winningSide;
            this.side = side;
            return this;
        }

        Fact own(Long runs, long overs) {
            ownRuns = runs;
            ownRunsWithBalls = runs;
            ownOvers = BigDecimal.valueOf(overs);
            return this;
        }

        Fact opp(Long runs, long overs) {
            oppRuns = runs;
            oppRunsWithBalls = runs;
            oppOvers = BigDecimal.valueOf(overs);
            return this;
        }

        Fact extras(Long total, Long wides, Long noBalls, Long byes, Long legByes, Long penalty) {
            this.extras = total;
            this.wides = wides;
            this.noBalls = noBalls;
            this.byes = byes;
            this.legByes = legByes;
            this.penalty = penalty;
            return this;
        }

        Fact dots(Long balls, Long dots, long rows, long rowsDotted) {
            bowlBalls = balls;
            bowlDots = dots;
            bowlRows = rows;
            bowlDotsRows = rowsDotted;
            return this;
        }

        Fact nrr(long ownRuns, long ownOvers, long oppRuns, long oppOvers) {
            nrrUsable = true;
            nrrOwnRuns = ownRuns;
            nrrOppRuns = oppRuns;
            nrrOwnOvers = BigDecimal.valueOf(ownOvers);
            nrrOppOvers = BigDecimal.valueOf(oppOvers);
            return this;
        }

        Fact forfeit(String winningSide, String side) {
            outcome = "FORFEIT";
            this.winningSide = winningSide;
            this.side = side;
            oppInnings = 0;
            ownUsable = 0;
            oppUsable = 0;
            ownRuns = null;
            ownWickets = null;
            ownBalls = null;
            ownRunsWithBalls = null;
            ownOvers = null;
            oppRuns = null;
            oppWickets = null;
            oppBalls = null;
            oppRunsWithBalls = null;
            oppOvers = null;
            return this;
        }

        ResultFact build() {
            return new ResultFact(
                    resultId, matchId, date, derby ? null : "Opp " + index, derby, outcome, winningSide, side, oppInnings,
                    ownUsable, oppUsable, ownRuns, ownWickets, ownBalls, ownRunsWithBalls, ownOvers, oppRuns, oppWickets,
                    oppBalls, oppRunsWithBalls, oppOvers, extras, wides, noBalls, byes, legByes, penalty, bowlBalls,
                    bowlDots, bowlRows, bowlDotsRows, nrrUsable, nrrOwnRuns, nrrOppRuns, nrrOwnOvers, nrrOppOvers);
        }
    }

    private static Fact fact() {
        return new Fact();
    }

    private static TeamDashboardDto build(NrrStatus status, boolean truncated, Fact... facts) {
        List<ResultFact> list = new ArrayList<>();
        for (Fact f : facts) {
            list.add(f.build());
        }
        return build(status, truncated, list);
    }

    private static TeamDashboardDto build(NrrStatus status, boolean truncated, List<ResultFact> facts) {
        return TeamDashboardSeriesBuilder.build(
                TEAM,
                "First XI",
                new TeamStatsPageScope("CLUB_VERIFIED", null, null, null),
                new TeamStatsPageBasis(facts.size(), 0, 0, null, 0),
                status,
                facts,
                truncated,
                List.of());
    }

    private static TeamDashboardDto build(Fact... facts) {
        return build(NrrStatus.NOT_ONE_COMPETITION, false, facts);
    }

    private static List<Fact> many(int count) {
        List<Fact> facts = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            facts.add(fact());
        }
        return facts;
    }

    // ---- envelope ----

    @Test
    void anEmptyScopeGivesEmptySeriesAndZeroCountsNotNulls() {
        TeamDashboardDto dto = build();

        assertThat(dto.teamId()).isEqualTo(TEAM);
        assertThat(dto.teamName()).isEqualTo("First XI");
        assertThat(dto.window().pointLimit()).isEqualTo(30);
        assertThat(dto.window().historyCap()).isEqualTo(300);
        assertThat(dto.results()).isEmpty();
        assertThat(dto.resultsSummary().played()).isZero();
        assertThat(dto.resultsSummary().wonPercent()).isNull();
        assertThat(dto.runRateTrend()).isEmpty();
        assertThat(dto.netRunRateTrend().points()).isEmpty();
        assertThat(dto.extrasConceded()).isEmpty();
        assertThat(dto.extrasSummary().matchesCounted()).isZero();
        assertThat(dto.dotBalls()).isEmpty();
        assertThat(dto.dotBallsSummary().averageDotPercent()).isNull();
        assertThat(dto.truncated()).isFalse();
        assertThat(dto.truncatedSince()).isNull();
    }

    // ---- result letters ----

    @ParameterizedTest
    @CsvSource({
        "WON, HOME, HOME, WON",
        "WON, HOME, AWAY, LOST",
        "WON, AWAY, AWAY, WON",
        "WON, AWAY, HOME, LOST",
        "TIE, , HOME, TIED",
        "DRAW, , AWAY, DRAWN",
        "NO_RESULT, , HOME, NO_RESULT",
        "ABANDONED, , AWAY, NO_RESULT"
    })
    void theResultLetterIsTheCalculatorsForTheTeamsSide(String outcome, String winner, String side, String letter) {
        TeamDashboardResult result = build(fact().outcome(outcome, winner, side)).results().get(0);

        assertThat(result.result()).isEqualTo(letter);
        assertThat(result.forfeit()).isFalse();
    }

    @Test
    void aDerbyGivesEachTeamItsOwnLetterAndTheDerbyFlag() {
        Fact home = fact();
        home.derby = true;
        home.outcome("WON", "HOME", "HOME");
        Fact away = fact();
        away.derby = true;
        away.outcome("WON", "HOME", "AWAY");

        TeamDashboardResult forHome = build(home).results().get(0);
        TeamDashboardResult forAway = build(away).results().get(0);

        assertThat(forHome.result()).isEqualTo("WON");
        assertThat(forAway.result()).isEqualTo("LOST");
        assertThat(forHome.derby()).isTrue();
        assertThat(forHome.opponentName()).isNull(); // the club's own other team is not named as an opponent
    }

    @Test
    void aForfeitHasItsLetterNoRunsAndIsFlagged() {
        TeamDashboardResult won = build(fact().forfeit("HOME", "HOME")).results().get(0);
        TeamDashboardResult lost = build(fact().forfeit("AWAY", "HOME")).results().get(0);

        assertThat(won.result()).isEqualTo("WON");
        assertThat(won.forfeit()).isTrue();
        assertThat(lost.result()).isEqualTo("LOST");
        assertThat(lost.forfeit()).isTrue();
        assertThat(won.ownRuns()).isNull();
        assertThat(won.oppRuns()).isNull();
        assertThat(won.ownRunRate()).isNull();
        assertThat(won.oppRunRate()).isNull();
    }

    @Test
    void aForfeitNeverShowsFiguresEvenIfTheFactRowCarriedSome() {
        Fact f = fact().forfeit("HOME", "HOME");
        f.ownUsable = 1;
        f.oppUsable = 1;
        f.ownRuns = 50L;
        f.oppRuns = 40L;

        TeamDashboardResult result = build(f).results().get(0);

        assertThat(result.ownRuns()).isNull();
        assertThat(result.oppRuns()).isNull();
    }

    @Test
    void aForfeitAppearsInTheResultsOnlyNeverInExtrasDotsOrRunRates() {
        Fact forfeit = fact().forfeit("HOME", "HOME");
        forfeit.extras(5L, 5L, null, null, null, null);
        forfeit.dots(60L, 20L, 1, 1);

        TeamDashboardDto dto = build(forfeit);

        assertThat(dto.results()).hasSize(1);
        assertThat(dto.extrasConceded()).isEmpty();
        assertThat(dto.dotBalls()).isEmpty();
        assertThat(dto.runRateTrend()).isEmpty();
        assertThat(dto.resultsSummary().forfeits()).isEqualTo(1);
        assertThat(dto.resultsSummary().played()).isEqualTo(1); // a forfeit is a win or a loss in the record
        assertThat(dto.resultsSummary().won()).isEqualTo(1);
    }

    @Test
    void theResultsSummaryCountsEveryLetterAndPercentsAreOfPlayedHalfUp() {
        TeamDashboardDto dto = build(
                fact(),
                fact(),
                fact().outcome("WON", "AWAY", "HOME"),
                fact().outcome("TIE", null, "HOME"),
                fact().outcome("DRAW", null, "HOME"),
                fact().outcome("NO_RESULT", null, "HOME"),
                fact().forfeit("AWAY", "HOME"));

        var s = dto.resultsSummary();

        assertThat(s.played()).isEqualTo(7);
        assertThat(s.won()).isEqualTo(2);
        assertThat(s.lost()).isEqualTo(2);
        assertThat(s.tied()).isEqualTo(1);
        assertThat(s.drawn()).isEqualTo(1);
        assertThat(s.noResult()).isEqualTo(1);
        assertThat(s.forfeits()).isEqualTo(1);
        assertThat(s.won() + s.lost() + s.tied() + s.drawn() + s.noResult()).isEqualTo(s.played());
        assertThat(s.wonPercent()).isEqualByComparingTo("28.6"); // 2/7 = 28.57
        assertThat(s.totalPoints()).isEqualTo(7);
        assertThat(s.shown()).isEqualTo(7);
    }

    // ---- runs scored and conceded, run rates ----

    @Test
    void runsScoredAndConcededComeFromTheRightInnings() {
        Fact f = fact().own(150L, 25).opp(120L, 24);
        f.ownWickets = 7L;
        f.oppWickets = 9L;
        f.ownBalls = 150L;
        f.oppBalls = 144L;

        TeamDashboardResult r = build(f).results().get(0);

        assertThat(r.ownRuns()).isEqualTo(150);
        assertThat(r.ownWickets()).isEqualTo(7);
        assertThat(r.ownBalls()).isEqualTo(150);
        assertThat(r.oppRuns()).isEqualTo(120);
        assertThat(r.oppWickets()).isEqualTo(9);
        assertThat(r.oppBalls()).isEqualTo(144);
        assertThat(r.ownRunRate()).isEqualByComparingTo("6.00");
        assertThat(r.oppRunRate()).isEqualByComparingTo("5.00");
    }

    @Test
    void anInningsWithNoUsableFigureIsLeftOutAndCountedNeverZero() {
        Fact f = fact();
        f.oppUsable = 0;
        f.oppRuns = null;
        f.oppRunsWithBalls = null;
        f.oppOvers = null;
        f.oppWickets = null;
        f.oppBalls = null;

        TeamDashboardDto dto = build(f, fact());
        TeamDashboardResult r = dto.results().get(0);

        assertThat(r.ownRuns()).isEqualTo(100);
        assertThat(r.oppRuns()).isNull();
        assertThat(r.oppWickets()).isNull();
        assertThat(r.oppRunRate()).isNull();
        assertThat(dto.resultsSummary().shown()).isEqualTo(2);
        assertThat(dto.resultsSummary().withRuns()).isEqualTo(1); // only the second has usable runs both sides
    }

    @Test
    void aRunRateIsNullWhenTheInningsHasNoBalls() {
        Fact f = fact();
        f.ownOvers = BigDecimal.ZERO;

        assertThat(build(f).results().get(0).ownRunRate()).isNull();
        assertThat(build(f).results().get(0).ownRuns()).isEqualTo(100);
    }

    @Test
    void theRunningRunRatesAreRunsOverOversToDateAndTheLastEqualsTheTotal() {
        TeamDashboardDto dto = build(
                fact().own(100L, 20).opp(80L, 20),
                fact().own(120L, 20).opp(90L, 20));

        var points = dto.runRateTrend();

        assertThat(points).hasSize(2);
        assertThat(points.get(0).teamRunRate()).isEqualByComparingTo("5.00");
        assertThat(points.get(0).oppositionRunRate()).isEqualByComparingTo("4.00");
        assertThat(points.get(1).teamRunRate()).isEqualByComparingTo("5.50"); // 220 / 40, not the mean of 5.00 and 6.00 either way
        assertThat(points.get(1).oppositionRunRate()).isEqualByComparingTo("4.25"); // 170 / 40
    }

    @Test
    void theRunningRunRateIsPooledOversNotAMeanOfMatchRates() {
        TeamDashboardDto dto = build(fact().own(100L, 10).opp(50L, 10), fact().own(30L, 40).opp(30L, 40));

        // 130 / 50 = 2.60; the mean of 10.00 and 0.75 would be 5.38
        assertThat(dto.runRateTrend().get(1).teamRunRate()).isEqualByComparingTo("2.60");
    }

    @Test
    void aResultWithNoBallsOnEitherSideAddsNoRunRatePoint() {
        Fact none = fact();
        none.ownOvers = null;
        none.oppOvers = null;

        TeamDashboardDto dto = build(fact(), none, fact());

        assertThat(dto.runRateTrend()).hasSize(2);
    }

    @Test
    void aResultWithBallsOnOneSideOnlyAddsOnlyThatSide() {
        Fact oneSide = fact().own(60L, 10);
        oneSide.oppOvers = null;
        oneSide.oppRunsWithBalls = null;

        TeamDashboardDto dto = build(fact().own(100L, 20).opp(80L, 20), oneSide);

        var second = dto.runRateTrend().get(1);
        assertThat(second.teamRunRate()).isEqualByComparingTo("5.33"); // 160 / 30
        assertThat(second.oppositionRunRate()).isEqualByComparingTo("4.00"); // unchanged: 80 / 20
    }

    // ---- net run rate ----

    @Test
    void theRunningNetRunRateIsOnlyBuiltWhenShownAndEqualsTheCalculatorsValue() {
        Fact a = fact().nrr(200, 40, 150, 40);
        Fact b = fact().nrr(100, 20, 130, 20);
        Fact unusable = fact(); // nrrUsable false: contributes nothing

        TeamDashboardDto dto = build(NrrStatus.SHOWN, false, a, unusable, b);

        var trend = dto.netRunRateTrend();
        assertThat(trend.status()).isEqualTo("SHOWN");
        assertThat(trend.points()).hasSize(2);
        assertThat(trend.points().get(0).value())
                .isEqualByComparingTo(TeamStatsCalculator.nrrValue(200, new BigDecimal("40"), 150, new BigDecimal("40")));
        assertThat(trend.points().get(0).value()).isEqualByComparingTo("1.25");
        assertThat(trend.points().get(1).value())
                .isEqualByComparingTo(TeamStatsCalculator.nrrValue(300, new BigDecimal("60"), 280, new BigDecimal("60")));
        assertThat(trend.points().get(1).value()).isEqualByComparingTo("0.33");
    }

    @ParameterizedTest
    @CsvSource({"NOT_ONE_COMPETITION", "NO_USABLE_RESULTS"})
    void aNetRunRateThatIsNotShownHasTheStatusAndNoPoints(NrrStatus status) {
        TeamDashboardDto dto = build(status, false, fact().nrr(200, 40, 150, 40));

        assertThat(dto.netRunRateTrend().status()).isEqualTo(status.name());
        assertThat(dto.netRunRateTrend().points()).isEmpty();
    }

    // ---- window, cap, ordering ----

    @Test
    void perMatchSeriesShowTheNewestThirtyOldestFirstAndRunningSeriesCoverAll() {
        List<Fact> facts = many(35);
        for (Fact f : facts) {
            f.extras(3L, 1L, null, null, null, null);
            f.dots(120L, 30L, 1, 1);
            f.nrr(100, 20, 80, 20);
        }

        TeamDashboardDto dto = build(NrrStatus.SHOWN, false, facts.toArray(new Fact[0]));

        assertThat(dto.results()).hasSize(30);
        assertThat(dto.results().get(0).resultId()).isEqualTo(facts.get(5).resultId);
        assertThat(dto.results().get(29).resultId()).isEqualTo(facts.get(34).resultId);
        assertThat(dto.resultsSummary().played()).isEqualTo(35);
        assertThat(dto.resultsSummary().totalPoints()).isEqualTo(35);
        assertThat(dto.resultsSummary().shown()).isEqualTo(30);
        assertThat(dto.runRateTrend()).hasSize(35);
        assertThat(dto.netRunRateTrend().points()).hasSize(35);
        assertThat(dto.extrasConceded()).hasSize(30);
        assertThat(dto.extrasSummary().totalPoints()).isEqualTo(35);
        assertThat(dto.extrasSummary().shown()).isEqualTo(30);
        assertThat(dto.dotBalls()).hasSize(30);
        assertThat(dto.dotBallsSummary().totalPoints()).isEqualTo(35);
        assertThat(dto.dotBallsSummary().shown()).isEqualTo(30);
    }

    @Test
    void theInputOrderIsKeptAndTruncatedCarriesTheOldestCoveredDate() {
        Fact first = fact();
        Fact second = fact();
        second.date = first.date; // a date tie keeps the caller's (date, match id) order

        TeamDashboardDto dto = build(NrrStatus.NOT_ONE_COMPETITION, true, first, second);

        assertThat(dto.results()).extracting(TeamDashboardResult::resultId).containsExactly(first.resultId, second.resultId);
        assertThat(dto.truncated()).isTrue();
        assertThat(dto.truncatedSince()).isEqualTo(first.date);
        assertThat(build(NrrStatus.NOT_ONE_COMPETITION, false, first).truncatedSince()).isNull();
    }

    @Test
    void aFullThreeHundredResultHistoryIsCarriedWholeInTheRunningSeries() {
        List<Fact> facts = many(300);

        TeamDashboardDto dto = build(NrrStatus.NOT_ONE_COMPETITION, true, facts.toArray(new Fact[0]));

        assertThat(dto.runRateTrend()).hasSize(300);
        assertThat(dto.resultsSummary().played()).isEqualTo(300);
        assertThat(dto.results()).hasSize(30);
    }

    // ---- extras conceded ----

    @Test
    void anItemisedInningsGivesItsComponentsAndATotalEqualToTheirSum() {
        TeamDashboardExtrasPoint p =
                build(fact().extras(10L, 4L, 2L, 3L, 1L, 0L)).extrasConceded().get(0);

        assertThat(p.wides()).isEqualTo(4);
        assertThat(p.noBalls()).isEqualTo(2);
        assertThat(p.byes()).isEqualTo(3);
        assertThat(p.legByes()).isEqualTo(1);
        assertThat(p.penaltyRuns()).isZero(); // a recorded zero is drawn as zero
        assertThat(p.itemised()).isTrue();
        assertThat(p.notItemised()).isNull();
        assertThat(p.total()).isEqualTo(p.wides() + p.noBalls() + p.byes() + p.legByes() + p.penaltyRuns());
    }

    @Test
    void aNullComponentStaysNullAmongRecordedOnes() {
        TeamDashboardExtrasPoint p =
                build(fact().extras(6L, 4L, null, 2L, null, null)).extrasConceded().get(0);

        assertThat(p.noBalls()).isNull();
        assertThat(p.legByes()).isNull();
        assertThat(p.penaltyRuns()).isNull();
        assertThat(p.total()).isEqualTo(6);
    }

    @Test
    void aTotalOnlyInningsIsNotItemisedWithNoComponents() {
        TeamDashboardExtrasPoint p =
                build(fact().extras(12L, null, null, null, null, null)).extrasConceded().get(0);

        assertThat(p.itemised()).isFalse();
        assertThat(p.notItemised()).isEqualTo(12);
        assertThat(p.total()).isEqualTo(12);
        assertThat(p.wides()).isNull();
        assertThat(p.noBalls()).isNull();
        assertThat(p.byes()).isNull();
        assertThat(p.legByes()).isNull();
        assertThat(p.penaltyRuns()).isNull();
    }

    @Test
    void anInningsWithNoExtrasRecordedIsAGapNeverZero() {
        TeamDashboardExtrasPoint p = build(fact()).extrasConceded().get(0);

        assertThat(p.total()).isNull();
        assertThat(p.notItemised()).isNull();
        assertThat(p.itemised()).isFalse();
    }

    @Test
    void aResultWithoutAnOppositionInningsHasNoExtrasPoint() {
        Fact noInnings = fact();
        noInnings.oppInnings = 0;

        assertThat(build(noInnings, fact()).extrasConceded()).hasSize(1);
        assertThat(build(noInnings, fact()).extrasSummary().totalPoints()).isEqualTo(1);
    }

    @Test
    void theExtrasCountsAndEachTypesSumEqualTheEverySourceFigure() {
        TeamDashboardDto dto = build(
                fact().extras(10L, 4L, 2L, 3L, 1L, null),
                fact().extras(7L, null, null, null, null, null), // total only
                fact(), // nothing recorded
                fact().extras(5L, 5L, null, null, null, null));

        var s = dto.extrasSummary();

        assertThat(s.matchesCounted()).isEqualTo(4);
        assertThat(s.matchesWithExtras()).isEqualTo(3);
        assertThat(s.matchesItemised()).isEqualTo(2);
        assertThat(s.widesRecorded()).isEqualTo(2);
        assertThat(s.noBallsRecorded()).isEqualTo(1);
        assertThat(s.byesRecorded()).isEqualTo(1);
        assertThat(s.legByesRecorded()).isEqualTo(1);
        assertThat(s.penaltyRunsRecorded()).isZero();
        long wideSum = dto.extrasConceded().stream()
                .map(TeamDashboardExtrasPoint::wides).filter(w -> w != null).mapToLong(Integer::longValue).sum();
        assertThat(wideSum).isEqualTo(9);
    }

    // ---- dot balls ----

    @Test
    void aMatchWhereEveryBowlerRowRecordedDotsGivesDotsBallsAndPercent() {
        TeamDashboardDotBallsPoint p = build(fact().dots(120L, 40L, 3, 3)).dotBalls().get(0);

        assertThat(p.ballsBowled()).isEqualTo(120);
        assertThat(p.dots()).isEqualTo(40);
        assertThat(p.dotPercent()).isEqualByComparingTo("33.3");
    }

    @Test
    void oneBowlerRowWithNullDotsMakesDotsAndPercentNullForThatMatch() {
        TeamDashboardDotBallsPoint p = build(fact().dots(120L, 30L, 3, 2)).dotBalls().get(0);

        assertThat(p.ballsBowled()).isEqualTo(120);
        assertThat(p.dots()).isNull();
        assertThat(p.dotPercent()).isNull();
    }

    @Test
    void aRecordedZeroDotsIsARealZeroAndZeroBallsIsAGap() {
        TeamDashboardDto dto = build(fact().dots(120L, 0L, 2, 2), fact().dots(0L, 0L, 0, 0), fact());

        assertThat(dto.dotBalls().get(0).dots()).isZero();
        assertThat(dto.dotBalls().get(0).dotPercent()).isEqualByComparingTo("0.0");
        assertThat(dto.dotBalls().get(1).dotPercent()).isNull();
        assertThat(dto.dotBalls().get(2).ballsBowled()).isNull();
        assertThat(dto.dotBalls().get(2).dotPercent()).isNull();
    }

    @Test
    void theAverageIsPooledOverChartedMatchesOnlyAndDiffersFromTheMeanOfThePercentages() {
        TeamDashboardDto dto = build(
                fact().dots(100L, 10L, 1, 1), // 10.0
                fact().dots(120L, 60L, 1, 1), // 50.0
                fact().dots(200L, 70L, 2, 1)); // not charted: a bowler row did not record dots

        var s = dto.dotBallsSummary();

        assertThat(s.averageDotPercent()).isEqualByComparingTo("31.8"); // 70 / 220, the mean of 10.0 and 50.0 would be 30.0
        assertThat(s.matchesWithDots()).isEqualTo(2);
        assertThat(s.matchesCounted()).isEqualTo(3);
    }

    @Test
    void theAverageIsNullWhenNoMatchIsCharted() {
        assertThat(build(fact().dots(100L, 10L, 2, 1)).dotBallsSummary().averageDotPercent()).isNull();
    }

    /** Three earlier charted matches at 30.0 percent, then five recent ones whose dots sum to {@code recentDots}. */
    private static Fact[] dotHistory(int recentDots) {
        List<Fact> facts = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            facts.add(fact().dots(200L, 60L, 1, 1));
        }
        for (int i = 0; i < 5; i++) {
            long share = recentDots / 5 + (i == 4 ? recentDots % 5 : 0);
            facts.add(fact().dots(200L, share, 1, 1));
        }
        return facts.toArray(new Fact[0]);
    }

    @ParameterizedTest
    @CsvSource({"305, FLAT", "306, UP", "295, FLAT", "294, DOWN"})
    void theDotTrendIsFlatWithinHalfAPointInclusive(int recentDots, String direction) {
        var s = build(dotHistory(recentDots)).dotBallsSummary();

        assertThat(s.earlierAverage()).isEqualByComparingTo("30.0");
        assertThat(s.direction()).isEqualTo(direction);
    }

    @Test
    void theDotTrendHasPooledRecentAndEarlierAverages() {
        var s = build(dotHistory(400)).dotBallsSummary(); // 400 / 1000 = 40.0 against 30.0

        assertThat(s.recentAverage()).isEqualByComparingTo("40.0");
        assertThat(s.earlierAverage()).isEqualByComparingTo("30.0");
        assertThat(s.direction()).isEqualTo("UP");
    }

    @Test
    void theDotTrendIsAbsentBelowThreeChartedMatchesPerHalf() {
        List<Fact> facts = new ArrayList<>();
        for (int i = 0; i < 7; i++) { // five recent and two earlier
            facts.add(fact().dots(200L, 60L, 1, 1));
        }

        var s = build(facts.toArray(new Fact[0])).dotBallsSummary();

        assertThat(s.recentAverage()).isNull();
        assertThat(s.earlierAverage()).isNull();
        assertThat(s.direction()).isNull();
    }

    @Test
    void uncharteredMatchesAreSkippedWhenFormingTheHalves() {
        List<Fact> facts = new ArrayList<>();
        facts.add(fact().dots(200L, 60L, 2, 1)); // not charted, the oldest: counting it would give the earlier half three
        for (int i = 0; i < 7; i++) {
            facts.add(fact().dots(200L, 60L, 1, 1));
        }

        assertThat(build(facts.toArray(new Fact[0])).dotBallsSummary().direction()).isNull();
    }
}
