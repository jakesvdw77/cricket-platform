package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.PlayerDashboardDto;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardBattingInnings;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardBowlingMatch;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardDismissal;
import com.cricketlegend.dto.PlayerDashboardDto.PlayerDashboardWicketType;
import com.cricketlegend.dto.PlayerStatsDto.PlayerStatsBasis;
import com.cricketlegend.dto.PlayerStatsDto.PlayerStatsScope;
import com.cricketlegend.service.support.PlayerMatchRowBuilder.BattingFact;
import com.cricketlegend.service.support.PlayerMatchRowBuilder.BowlingFact;
import com.cricketlegend.service.support.PlayerMatchRowBuilder.MatchHeader;
import com.cricketlegend.service.support.PlayerStatsCalculator.BowlingCredit;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * docs/specs/117-stats-dashboard.md, "Player series" and Test Plan: the shape of every player series, the window and cap,
 * and the parity-by-construction sums (the figures all come from the calculator over the same facts).
 */
class PlayerDashboardSeriesBuilderTest {

    private static final UUID PLAYER = UUID.randomUUID();
    private static final Instant DAY_ONE = Instant.parse("2026-01-03T09:00:00Z");

    /** A match in the fixture: header plus the facts that hang off its result id. */
    private static final class Fixture {
        final List<MatchHeader> headers = new ArrayList<>();
        final List<BattingFact> batting = new ArrayList<>();
        final List<BowlingFact> bowling = new ArrayList<>();
        final List<BowlingCredit> credits = new ArrayList<>();

        /** A normal match on the home side, both cards captured, six-ball overs, one day after the previous. */
        UUID match() {
            return match(6, false, true, true);
        }

        UUID match(int ballsPerOver, boolean derby, boolean battingCard, boolean bowlingCard) {
            UUID result = UUID.randomUUID();
            int index = headers.size();
            headers.add(new MatchHeader(
                    result, UUID.randomUUID(), DAY_ONE.plusSeconds(86_400L * index), ballsPerOver,
                    ResultOutcomeType.WON, ResultSide.HOME, derby, true, derby, null, null,
                    UUID.randomUUID(), "Home XI", UUID.randomUUID(), "Away XI", "Opp " + index, battingCard, bowlingCard));
            return result;
        }

        Fixture bat(UUID result, int runs, DismissalType howOut) {
            batting.add(new BattingFact(result, runs, null, null, null, howOut));
            return this;
        }

        Fixture bowl(UUID result, int balls, int runs, int wickets) {
            bowling.add(new BowlingFact(result, balls, 0, runs, wickets, null, null, null));
            return this;
        }

        PlayerDashboardDto build(PlayerStatsCounters counters, boolean truncated) {
            return PlayerDashboardSeriesBuilder.build(
                    PLAYER,
                    new PlayerStatsScope("CLUB_VERIFIED", null, null, null, null, null),
                    new PlayerStatsBasis(headers.size(), 0, 0),
                    counters,
                    headers,
                    truncated,
                    batting,
                    bowling,
                    credits,
                    PlayerStatsCalculator.NOT_CAPTURED);
        }

        PlayerDashboardDto build() {
            return build(PlayerStatsCounters.EMPTY, false);
        }
    }

    private static List<Long> runsOf(PlayerDashboardDto dto) {
        return dto.battingInnings().stream().map(i -> i.runs().longValue()).toList();
    }

    // ---- the envelope ----

    @Test
    void anEmptyScopeGivesEmptySeriesAndZeroSummariesNeverNulls() {
        PlayerDashboardDto dto = new Fixture().build();

        assertThat(dto.playerId()).isEqualTo(PLAYER);
        assertThat(dto.window().pointLimit()).isEqualTo(30);
        assertThat(dto.window().historyCap()).isEqualTo(300);
        assertThat(dto.truncated()).isFalse();
        assertThat(dto.truncatedSince()).isNull();
        assertThat(dto.battingInnings()).isEmpty();
        assertThat(dto.dismissals()).isEmpty();
        assertThat(dto.battingTrend()).isEmpty();
        assertThat(dto.bowlingMatches()).isEmpty();
        assertThat(dto.battingSummary().inningsTotal()).isZero();
        assertThat(dto.battingSummary().averageRuns()).isNull();
        assertThat(dto.economySummary().overallEconomy()).isNull();
        assertThat(dto.economySummary().direction()).isNull();
        assertThat(dto.wicketTypes().total()).isZero();
        assertThat(dto.wicketTypes().notItemised().count()).isZero();
        assertThat(dto.notCaptured()).isEqualTo(PlayerStatsCalculator.NOT_CAPTURED);
    }

    // ---- batting: runs per innings ----

    @Test
    void inningsAreInTheOrderGivenWithNotOutDerivedFromHowOut() {
        Fixture f = new Fixture();
        f.bat(f.match(), 10, DismissalType.BOWLED);
        f.bat(f.match(), 20, DismissalType.NOT_OUT);
        f.bat(f.match(), 30, DismissalType.RETIRED_NOT_OUT);
        f.bat(f.match(), 40, DismissalType.RETIRED_OUT);
        f.bat(f.match(), 50, DismissalType.RUN_OUT);

        List<PlayerDashboardBattingInnings> innings = f.build().battingInnings();

        assertThat(runsOf(f.build())).containsExactly(10L, 20L, 30L, 40L, 50L);
        assertThat(innings).extracting(PlayerDashboardBattingInnings::notOut)
                .containsExactly(false, true, true, false, false);
        assertThat(innings).extracting(PlayerDashboardBattingInnings::howOut)
                .containsExactly("BOWLED", "NOT_OUT", "RETIRED_NOT_OUT", "RETIRED_OUT", "RUN_OUT");
    }

    @Test
    void aMatchWithNoCardOrWhoDidNotBatIsAbsentNotZero() {
        Fixture f = new Fixture();
        f.bat(f.match(), 25, DismissalType.BOWLED);
        f.match(6, false, false, false); // NO_CARD
        f.match(6, false, true, false); // card captured, did not bat
        f.bat(f.match(), 0, DismissalType.BOWLED); // a genuine duck stays

        PlayerDashboardDto dto = f.build();

        assertThat(runsOf(dto)).containsExactly(25L, 0L);
        assertThat(dto.battingSummary().inningsTotal()).isEqualTo(2);
        assertThat(dto.battingTrend()).hasSize(2);
        assertThat(dto.dismissals().stream().mapToLong(PlayerDashboardDismissal::count).sum()).isEqualTo(2);
    }

    @Test
    void aTwoInningsMatchIsTwoPointsInOrder() {
        Fixture f = new Fixture();
        UUID m = f.match();
        f.bat(m, 11, DismissalType.CAUGHT);
        f.bat(m, 22, DismissalType.NOT_OUT);

        PlayerDashboardDto dto = f.build();

        assertThat(runsOf(dto)).containsExactly(11L, 22L);
        assertThat(dto.battingInnings().get(0).matchId()).isEqualTo(dto.battingInnings().get(1).matchId());
    }

    @Test
    void theRunningAverageIsNullUntilTheFirstDismissalAndNotOutsRaiseRunsNotTheDenominator() {
        Fixture f = new Fixture();
        f.bat(f.match(), 20, DismissalType.NOT_OUT);
        f.bat(f.match(), 10, DismissalType.BOWLED);
        f.bat(f.match(), 30, DismissalType.LBW);
        f.bat(f.match(), 5, DismissalType.NOT_OUT);
        f.bat(f.match(), 40, DismissalType.CAUGHT);

        var trend = f.build().battingTrend();

        assertThat(trend).extracting(t -> t.cumulativeRuns()).containsExactly(20L, 30L, 60L, 65L, 105L);
        assertThat(trend).extracting(t -> t.cumulativeDismissals()).containsExactly(0L, 1L, 2L, 2L, 3L);
        assertThat(trend.get(0).average()).isNull();
        assertThat(trend.get(1).average()).isEqualByComparingTo("30.00");
        assertThat(trend.get(2).average()).isEqualByComparingTo("30.00");
        assertThat(trend.get(3).average()).isEqualByComparingTo("32.50");
        assertThat(trend.get(4).average()).isEqualByComparingTo("35.00");
    }

    @Test
    void theLastRunningAverageEqualsTheBattingTabAverageForTheSameInnings() {
        Fixture f = new Fixture();
        f.bat(f.match(), 20, DismissalType.NOT_OUT);
        f.bat(f.match(), 10, DismissalType.BOWLED);
        f.bat(f.match(), 40, DismissalType.CAUGHT);
        var counters = PlayerStatsTestData.counters().bat(3, 2, 70).build();

        PlayerDashboardDto dto = f.build(counters, false);

        var last = dto.battingTrend().get(2);
        assertThat(last.average()).isEqualByComparingTo(dto.battingSummary().averageRuns());
        assertThat(dto.battingSummary().averageRuns()).isEqualByComparingTo("35.00");
    }

    @Test
    void theBattingSummaryCountsInningsNotOutsAndRunsOfTheCoveredMatches() {
        Fixture f = new Fixture();
        f.bat(f.match(), 20, DismissalType.NOT_OUT);
        f.bat(f.match(), 10, DismissalType.BOWLED);
        f.bat(f.match(), 5, DismissalType.RETIRED_NOT_OUT);

        var summary = f.build().battingSummary();

        assertThat(summary.inningsTotal()).isEqualTo(3);
        assertThat(summary.shown()).isEqualTo(3);
        assertThat(summary.notOuts()).isEqualTo(2);
        assertThat(summary.runs()).isEqualTo(35);
        assertThat(summary.averageRuns()).isNull(); // no counters: no dismissals in the scope
    }

    @Test
    void theDismissalsDonutSumsToInningsWithNotOutFirstAsOneSliceAndPercentsOfInnings() {
        Fixture f = new Fixture();
        f.bat(f.match(), 1, DismissalType.BOWLED);
        f.bat(f.match(), 2, DismissalType.NOT_OUT);
        f.bat(f.match(), 3, DismissalType.CAUGHT);
        f.bat(f.match(), 4, DismissalType.RETIRED_NOT_OUT);
        f.bat(f.match(), 5, DismissalType.BOWLED);

        PlayerDashboardDto dto = f.build();
        List<PlayerDashboardDismissal> slices = dto.dismissals();

        assertThat(slices).extracting(PlayerDashboardDismissal::type).containsExactly("NOT_OUT", "BOWLED", "CAUGHT");
        assertThat(slices).extracting(PlayerDashboardDismissal::label).containsExactly("Not out", "Bowled", "Caught");
        assertThat(slices).extracting(PlayerDashboardDismissal::count).containsExactly(2L, 2L, 1L);
        assertThat(slices).extracting(PlayerDashboardDismissal::percent).satisfiesExactly(
                p -> assertThat(p).isEqualByComparingTo("40.0"),
                p -> assertThat(p).isEqualByComparingTo("40.0"),
                p -> assertThat(p).isEqualByComparingTo("20.0"));
        assertThat(slices.stream().mapToLong(PlayerDashboardDismissal::count).sum())
                .isEqualTo(dto.battingSummary().inningsTotal());
    }

    // ---- window, cap, truncation ----

    @Test
    void perInningsAndPerMatchSeriesShowTheNewestThirtyWhileRunningSeriesCoverEverything() {
        Fixture f = new Fixture();
        for (int i = 0; i < 35; i++) {
            UUID m = f.match();
            f.bat(m, 10 + i, DismissalType.BOWLED);
            f.bowl(m, 12, 10, 1);
        }

        PlayerDashboardDto dto = f.build();

        assertThat(dto.battingInnings()).hasSize(30);
        assertThat(dto.battingInnings().get(0).runs()).isEqualTo(15); // the 6th match is the oldest shown
        assertThat(dto.battingInnings().get(29).runs()).isEqualTo(44);
        assertThat(dto.battingTrend()).hasSize(35);
        assertThat(dto.battingSummary().inningsTotal()).isEqualTo(35);
        assertThat(dto.battingSummary().shown()).isEqualTo(30);
        assertThat(dto.dismissals().get(0).count()).isEqualTo(35);
        assertThat(dto.bowlingMatches()).hasSize(30);
        assertThat(dto.economySummary().totalPoints()).isEqualTo(35);
        assertThat(dto.economySummary().shown()).isEqualTo(30);
        assertThat(dto.economySummary().matchesCounted()).isEqualTo(30);
    }

    @Test
    void exactlyThirtyMatchesAreAllShown() {
        Fixture f = new Fixture();
        for (int i = 0; i < 30; i++) {
            f.bat(f.match(), i, DismissalType.BOWLED);
        }

        assertThat(f.build().battingInnings()).hasSize(30);
        assertThat(f.build().battingSummary().inningsTotal()).isEqualTo(30);
    }

    @Test
    void truncatedCarriesTheDateOfTheOldestCoveredMatch() {
        Fixture f = new Fixture();
        f.bat(f.match(), 1, DismissalType.BOWLED);
        f.bat(f.match(), 2, DismissalType.BOWLED);

        PlayerDashboardDto truncated = f.build(PlayerStatsCounters.EMPTY, true);
        PlayerDashboardDto whole = f.build(PlayerStatsCounters.EMPTY, false);

        assertThat(truncated.truncated()).isTrue();
        assertThat(truncated.truncatedSince()).isEqualTo(DAY_ONE);
        assertThat(whole.truncated()).isFalse();
        assertThat(whole.truncatedSince()).isNull();
    }

    @Test
    void aFullThreeHundredMatchHistoryIsCarriedWholeInTheRunningSeries() {
        Fixture f = new Fixture();
        for (int i = 0; i < 300; i++) {
            f.bat(f.match(), 1, DismissalType.BOWLED);
        }

        PlayerDashboardDto dto = f.build(PlayerStatsCounters.EMPTY, true);

        assertThat(dto.battingTrend()).hasSize(300);
        assertThat(dto.battingTrend().get(299).cumulativeRuns()).isEqualTo(300);
        assertThat(dto.truncated()).isTrue();
    }

    @Test
    void headersGivenOldestFirstAreNeverResortedSoDateTiesKeepTheirInputOrder() {
        Fixture f = new Fixture();
        UUID first = f.match();
        UUID second = f.match();
        UUID third = f.match();
        // all three on the same instant; the caller's order (date, then match id) is kept
        List<MatchHeader> tied = new ArrayList<>();
        for (MatchHeader h : f.headers) {
            tied.add(new MatchHeader(h.resultId(), h.matchId(), DAY_ONE, 6, h.outcome(), h.winningSide(), false, true,
                    false, null, null, h.homeTeamId(), "Home XI", h.awayTeamId(), "Away XI", h.opponentName(), true, true));
        }
        f.headers.clear();
        f.headers.addAll(tied);
        f.bat(first, 1, DismissalType.BOWLED);
        f.bat(second, 2, DismissalType.BOWLED);
        f.bat(third, 3, DismissalType.BOWLED);

        assertThat(runsOf(f.build())).containsExactly(1L, 2L, 3L);
    }

    // ---- bowling: wickets per match ----

    @Test
    void wicketsPerMatchSkipsDidNotBowlAndNoCardButKeepsAGenuineZeroWicketSpell() {
        Fixture f = new Fixture();
        f.bowl(f.match(), 12, 20, 0); // a real 0-wicket spell
        f.match(6, false, true, true); // bowling card captured, did not bowl
        f.match(6, false, false, false); // no card
        f.bowl(f.match(), 18, 15, 3);

        List<PlayerDashboardBowlingMatch> matches = f.build().bowlingMatches();

        assertThat(matches).extracting(PlayerDashboardBowlingMatch::wickets).containsExactly(0L, 3L);
        assertThat(matches).extracting(PlayerDashboardBowlingMatch::balls).containsExactly(12L, 18L);
    }

    @Test
    void aMatchWhereTheBowlerHadWicketsButNoBallsIsAPointWithAGapEconomy() {
        Fixture f = new Fixture();
        f.bowl(f.match(), 0, 0, 1);

        var summary = f.build().economySummary();
        var match = f.build().bowlingMatches().get(0);

        assertThat(match.wickets()).isEqualTo(1);
        assertThat(match.economy()).isNull();
        assertThat(summary.matchesCounted()).isEqualTo(1);
        assertThat(summary.matchesWithEconomy()).isZero();
    }

    @Test
    void aDerbyIsOneBowlingPointSummingBothSidesWithNoOpponentName() {
        Fixture f = new Fixture();
        UUID derby = f.match(6, true, true, true);
        f.bowl(derby, 12, 10, 1);
        f.bowl(derby, 6, 8, 2);
        f.bat(derby, 30, DismissalType.BOWLED);

        PlayerDashboardDto dto = f.build();

        assertThat(dto.bowlingMatches()).hasSize(1);
        var point = dto.bowlingMatches().get(0);
        assertThat(point.derby()).isTrue();
        assertThat(point.opponentName()).isNull();
        assertThat(point.balls()).isEqualTo(18);
        assertThat(point.runs()).isEqualTo(18);
        assertThat(point.wickets()).isEqualTo(3);
        assertThat(point.economy()).isEqualByComparingTo("6.00");
        assertThat(dto.battingInnings().get(0).opponentName()).isNull();
        assertThat(dto.battingInnings().get(0).derby()).isTrue();
        assertThat(dto.battingTrend().get(0).opponentName()).isNull();
    }

    @Test
    void aNormalMatchCarriesTheOpponentNameAndNoOtherPersonIsNamed() {
        Fixture f = new Fixture();
        UUID m = f.match();
        f.bat(m, 5, DismissalType.BOWLED);
        f.bowl(m, 6, 5, 1);

        PlayerDashboardDto dto = f.build();

        assertThat(dto.battingInnings().get(0).opponentName()).isEqualTo("Opp 0");
        assertThat(dto.bowlingMatches().get(0).opponentName()).isEqualTo("Opp 0");
        assertThat(dto.battingTrend().get(0).opponentName()).isEqualTo("Opp 0");
    }

    // ---- economy ----

    @Test
    void aMatchEconomyIsRunsPerOverOfThatMatchsOwnBallsPerOver() {
        Fixture f = new Fixture();
        f.bowl(f.match(6, false, true, true), 36, 30, 2); // 6 overs: 5.00
        f.bowl(f.match(5, false, true, true), 30, 30, 1); // six overs of five balls: 5.00, not 6.00

        var matches = f.build().bowlingMatches();

        assertThat(matches.get(0).economy()).isEqualByComparingTo("5.00");
        assertThat(matches.get(1).economy()).isEqualByComparingTo("5.00");
        assertThat(matches.get(1).ballsPerOver()).isEqualTo(5);
    }

    @Test
    void overallEconomyIsTheScopeTotalNotTheMeanOfTheMatchFigures() {
        Fixture f = new Fixture();
        f.bowl(f.match(), 36, 30, 1); // 5.00
        f.bowl(f.match(), 6, 10, 0); // 10.00
        var counters = PlayerStatsTestData.counters().bowl(2, 42, 40, 1).build();

        PlayerDashboardDto dto = f.build(counters, false);

        assertThat(dto.bowlingMatches()).extracting(PlayerDashboardBowlingMatch::economy).satisfiesExactly(
                e -> assertThat(e).isEqualByComparingTo("5.00"), e -> assertThat(e).isEqualByComparingTo("10.00"));
        assertThat(dto.economySummary().overallEconomy()).isEqualByComparingTo("5.71"); // 40 / 7, not 7.50
    }

    @Test
    void theReferenceLineCoversTheFullScopeEvenWhenOnlyThirtyMatchesAreDrawn() {
        Fixture f = new Fixture();
        for (int i = 0; i < 35; i++) {
            f.bowl(f.match(), 6, 6, 0); // every match 6.00
        }
        // the scope's own counters differ from the drawn points (older matches were cheaper): 35 overs, 175 runs = 5.00
        var counters = PlayerStatsTestData.counters().bowl(35, 210, 175, 0).build();

        var summary = f.build(counters, false).economySummary();

        assertThat(summary.overallEconomy()).isEqualByComparingTo("5.00");
        assertThat(summary.shown()).isEqualTo(30);
        assertThat(summary.totalPoints()).isEqualTo(35);
    }

    @Test
    void mixedBallsPerOverInOneScopeUsesTheScopeOversForTheReferenceLine() {
        Fixture f = new Fixture();
        f.bowl(f.match(6, false, true, true), 36, 30, 0); // 6 overs, 5.00
        f.bowl(f.match(8, false, true, true), 32, 24, 0); // 4 overs, 6.00
        var counters = PlayerStatsTestData.counters().bowl(2, 68, 54, 0).overs("10").ballsPerOver(6, 8).build();

        PlayerDashboardDto dto = f.build(counters, false);

        assertThat(dto.bowlingMatches().get(1).economy()).isEqualByComparingTo("6.00");
        assertThat(dto.economySummary().overallEconomy()).isEqualByComparingTo("5.40");
    }

    @Test
    void noBallsBowledInTheScopeGivesNoReferenceLine() {
        Fixture f = new Fixture();
        f.bowl(f.match(), 0, 0, 1);

        assertThat(f.build(PlayerStatsTestData.counters().build(), false).economySummary().overallEconomy()).isNull();
    }

    @Test
    void theEconomyCountsSeparateMatchesWithAndWithoutAFigure() {
        Fixture f = new Fixture();
        f.bowl(f.match(), 6, 6, 0);
        f.bowl(f.match(), 0, 0, 1); // a gap
        f.bowl(f.match(), 12, 10, 0);

        var summary = f.build().economySummary();

        assertThat(summary.matchesCounted()).isEqualTo(3);
        assertThat(summary.matchesWithEconomy()).isEqualTo(2);
        assertThat(summary.totalPoints()).isEqualTo(3);
    }

    /** Eight one-over matches: three earlier at 6 runs, five recent summing to {@code recentRuns} over 20 overs. */
    private static Fixture economyHistory(int earlierRuns, int recentRuns) {
        Fixture f = new Fixture();
        for (int i = 0; i < 3; i++) {
            f.bowl(f.match(), 24, earlierRuns, 0); // four-over matches
        }
        for (int i = 0; i < 5; i++) {
            int share = recentRuns / 5 + (i == 4 ? recentRuns % 5 : 0);
            f.bowl(f.match(), 24, share, 0);
        }
        return f;
    }

    @Test
    void theTrendHintPoolsTheLastFiveAgainstTheFiveBefore() {
        var summary = economyHistory(16, 60).build().economySummary(); // earlier 48/12 = 4.00, recent 60/20 = 3.00

        assertThat(summary.recentEconomy()).isEqualByComparingTo("3.00");
        assertThat(summary.earlierEconomy()).isEqualByComparingTo("4.00");
        assertThat(summary.direction()).isEqualTo("DOWN");
    }

    @Test
    void theTrendHintIsAbsentWhenAHalfHasFewerThanThreeMatches() {
        Fixture f = new Fixture();
        for (int i = 0; i < 7; i++) { // five recent and only two earlier
            f.bowl(f.match(), 24, 20, 0);
        }

        var summary = f.build().economySummary();

        assertThat(summary.recentEconomy()).isNull();
        assertThat(summary.earlierEconomy()).isNull();
        assertThat(summary.direction()).isNull();
    }

    @Test
    void matchesWithoutAnEconomyAreSkippedWhenFormingTheHalves() {
        Fixture f = new Fixture();
        f.bowl(f.match(), 0, 0, 1); // a gap, oldest: counting it would give the earlier half its third point
        for (int i = 0; i < 7; i++) {
            f.bowl(f.match(), 24, 20, 0);
        }

        assertThat(f.build().economySummary().direction()).isNull();
    }

    @ParameterizedTest
    @CsvSource({"85, FLAT", "86, UP", "75, FLAT", "74, DOWN"})
    void theTrendDirectionIsFlatWithinAQuarterOfARunAnOverInclusive(int recentRuns, String direction) {
        // earlier 48 runs / 12 overs = 4.00; recent N / 20 overs
        var summary = economyHistory(16, recentRuns).build().economySummary();

        assertThat(summary.direction()).isEqualTo(direction);
    }

    // ---- wickets by type ----

    private static BowlingCredit credit(UUID row, int wickets, DismissalType type, long count) {
        return new BowlingCredit(row, wickets, type, count);
    }

    @Test
    void wicketsByTypeListsAllSixTypesInFixedOrderWithSharesAndNotItemised() {
        Fixture f = new Fixture();
        UUID row = UUID.randomUUID();
        f.credits.add(credit(row, 5, DismissalType.LBW, 1));
        f.credits.add(credit(row, 5, DismissalType.BOWLED, 2));
        f.credits.add(credit(row, 5, DismissalType.CAUGHT_AND_BOWLED, 1));

        var types = f.build().wicketTypes();

        assertThat(types.types()).extracting(PlayerDashboardWicketType::type)
                .containsExactly("BOWLED", "CAUGHT", "CAUGHT_AND_BOWLED", "LBW", "STUMPED", "HIT_WICKET");
        assertThat(types.types()).extracting(PlayerDashboardWicketType::count).containsExactly(2L, 0L, 1L, 1L, 0L, 0L);
        assertThat(types.types().get(0).percent()).isEqualByComparingTo("40.0");
        assertThat(types.types().get(1).percent()).isEqualByComparingTo("0.0");
        assertThat(types.types().get(2).label()).isEqualTo("Caught and bowled");
        assertThat(types.notItemised().count()).isEqualTo(1);
        assertThat(types.notItemised().percent()).isEqualByComparingTo("20.0");
        assertThat(types.total()).isEqualTo(5);
        assertThat(types.itemised()).isEqualTo(4);
        assertThat(types.coverage().wicketsItemised()).isEqualTo(4);
        assertThat(types.coverage().wicketsTotal()).isEqualTo(5);
        assertThat(types.coverage().inningsItemised()).isEqualTo(1);
        assertThat(types.coverage().inningsWithWickets()).isEqualTo(1);
    }

    @Test
    void wicketTypePercentagesRoundHalfUpToOneDecimalAndAreNullAtTotalZero() {
        Fixture withWickets = new Fixture();
        UUID row = UUID.randomUUID();
        withWickets.credits.add(credit(row, 16, DismissalType.CAUGHT, 1));

        assertThat(withWickets.build().wicketTypes().types().get(1).percent()).isEqualByComparingTo("6.3");

        var none = new Fixture().build().wicketTypes();
        assertThat(none.total()).isZero();
        assertThat(none.types()).hasSize(6).allSatisfy(t -> {
            assertThat(t.count()).isZero();
            assertThat(t.percent()).isNull();
        });
        assertThat(none.notItemised().percent()).isNull();
    }

    @Test
    void overCreditedAndNonBowlerWicketsStayNotItemisedAndTheTotalIsTheStoredWickets() {
        Fixture f = new Fixture();
        UUID over = UUID.randomUUID();
        UUID runOut = UUID.randomUUID();
        f.credits.add(credit(over, 1, DismissalType.BOWLED, 2));
        f.credits.add(credit(runOut, 2, DismissalType.RUN_OUT, 2));

        var types = f.build().wicketTypes();

        assertThat(types.types()).allSatisfy(t -> assertThat(t.count()).isZero());
        assertThat(types.notItemised().count()).isEqualTo(3);
        assertThat(types.total()).isEqualTo(3);
        assertThat(types.itemised()).isZero();
    }

    @Test
    void aDerbySumsBothSidesRowsIntoTheSplit() {
        Fixture f = new Fixture();
        f.credits.add(credit(UUID.randomUUID(), 1, DismissalType.BOWLED, 1));
        f.credits.add(credit(UUID.randomUUID(), 2, DismissalType.BOWLED, 1));
        f.credits.add(credit(UUID.randomUUID(), 2, DismissalType.BOWLED, 1));

        var types = f.build().wicketTypes();

        assertThat(types.types().get(0).count()).isEqualTo(3);
        assertThat(types.total()).isEqualTo(5);
        assertThat(types.notItemised().count()).isEqualTo(2);
    }

    // ---- parity by construction ----

    @Test
    void everySeriesSumsToTheSameFiguresTheTilesAreMadeOf() {
        Fixture f = new Fixture();
        long runs = 0;
        long wickets = 0;
        long innings = 0;
        for (int i = 0; i < 12; i++) {
            UUID m = f.match();
            DismissalType out = i % 3 == 0 ? DismissalType.NOT_OUT : i % 3 == 1 ? DismissalType.BOWLED : DismissalType.CAUGHT;
            f.bat(m, 7 * i, out);
            runs += 7 * i;
            innings++;
            if (i % 2 == 0) {
                int w = i % 4;
                f.bowl(m, 12, 9 + i, w);
                wickets += w;
                if (w > 0) {
                    f.credits.add(credit(UUID.randomUUID(), w, DismissalType.BOWLED, 1));
                }
            }
        }

        PlayerDashboardDto dto = f.build();

        assertThat(dto.battingInnings().stream().mapToLong(i -> i.runs()).sum()).isEqualTo(runs);
        assertThat(dto.battingSummary().runs()).isEqualTo(runs);
        assertThat(dto.battingTrend().get(11).cumulativeRuns()).isEqualTo(runs);
        assertThat(dto.dismissals().stream().mapToLong(PlayerDashboardDismissal::count).sum()).isEqualTo(innings);
        assertThat(dto.bowlingMatches().stream().mapToLong(PlayerDashboardBowlingMatch::wickets).sum()).isEqualTo(wickets);
        long typed = dto.wicketTypes().types().stream().mapToLong(PlayerDashboardWicketType::count).sum();
        assertThat(typed + dto.wicketTypes().notItemised().count()).isEqualTo(wickets);
        assertThat(dto.wicketTypes().total()).isEqualTo(wickets);
    }
}
