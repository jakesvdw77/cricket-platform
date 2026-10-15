package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.service.support.StandoutRules.Batter;
import com.cricketlegend.service.support.StandoutRules.Bowler;
import com.cricketlegend.service.support.StandoutRules.Fielder;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/101-match-results-our-side-scorecard.md Test Plan: {@link StandoutRules}, the relative standout
 * suggestions: top N, share of the innings, top scorer, bowling by wickets then economy, the fielding minimum, ties,
 * and the figures that are never suggested (no run, no ball and no wicket). Pure logic over neutral figures.
 */
class StandoutRulesTest {

    // ---- batting ----

    @Test
    void battersInTheTopThreeWithAQuarterOfTheInningsAreSuggested() {
        List<Batter<String>> batters = List.of(new Batter<>("a", 60, 40), new Batter<>("b", 55, 50),
                new Batter<>("c", 30, 30), new Batter<>("d", 20, 20));

        // 200 runs: a (30%) and b (27.5%) clear a quarter; c (15%) is in the top three but short of the share
        assertThat(StandoutRules.battingSuggestions(batters, 200)).containsExactlyInAnyOrder("a", "b");
    }

    @Test
    void exactlyAQuarterOfTheInningsIsEnough() {
        assertThat(StandoutRules.battingSuggestions(
                List.of(new Batter<>("a", 90, 60), new Batter<>("b", 50, 40)), 200)).containsExactlyInAnyOrder("a", "b");
        assertThat(StandoutRules.battingSuggestions(
                List.of(new Batter<>("a", 90, 60), new Batter<>("b", 49, 40)), 200)).containsExactly("a");
    }

    @Test
    void aBatterOutsideTheTopThreeIsNeverSuggestedWhateverTheShare() {
        // four batters on 60 of 200: ordered by fewer balls, the slowest is fourth
        List<Batter<String>> batters = List.of(new Batter<>("slow", 60, 43), new Batter<>("c", 60, 42),
                new Batter<>("a", 60, 40), new Batter<>("b", 60, 41));

        assertThat(StandoutRules.battingSuggestions(batters, 200)).containsExactlyInAnyOrder("a", "b", "c");
    }

    @Test
    void theTopScorerIsAlwaysSuggestedEvenWithATinyShare() {
        List<Batter<String>> batters = List.of(new Batter<>("a", 30, 25), new Batter<>("b", 20, 20), new Batter<>("c", 10, 9));

        assertThat(StandoutRules.battingSuggestions(batters, 300)).containsExactly("a");
    }

    @Test
    void theTopScorerStillCountsWhenTheInningsTotalIsNotEnteredYet() {
        List<Batter<String>> batters = List.of(new Batter<>("a", 30, 25), new Batter<>("b", 20, 20));

        assertThat(StandoutRules.battingSuggestions(batters, null)).containsExactly("a");
    }

    @Test
    void twoBattersWithTheSameRunsAndBallsShareTheTopScorerSpot() {
        List<Batter<String>> batters = List.of(new Batter<>("a", 30, 25), new Batter<>("b", 30, 25), new Batter<>("c", 2, 5));

        assertThat(StandoutRules.battingSuggestions(batters, 1000)).containsExactlyInAnyOrder("a", "b");
        // the same runs off fewer balls wins outright
        assertThat(StandoutRules.battingSuggestions(
                List.of(new Batter<>("a", 30, 25), new Batter<>("b", 30, 20)), 1000)).containsExactly("b");
    }

    @Test
    void aBatterWithNoRunsIsNeverSuggestedNotEvenWhenTheInningsHadNone() {
        assertThat(StandoutRules.battingSuggestions(List.of(new Batter<>("a", 0, 12), new Batter<>("b", 0, 3)), 0)).isEmpty();
        assertThat(StandoutRules.battingSuggestions(List.of(new Batter<>("a", 0, 12), new Batter<>("b", 5, 8)), 10))
                .containsExactly("b");
        assertThat(StandoutRules.battingSuggestions(List.<Batter<String>>of(), 100)).isEmpty();
    }

    @Test
    void unknownBallsRankAfterKnownOnesAmongEqualRuns() {
        List<Batter<String>> batters = List.of(new Batter<>("unknown", 40, null), new Batter<>("known", 40, 30));

        assertThat(StandoutRules.battingSuggestions(batters, 100)).containsExactlyInAnyOrder("unknown", "known");
        assertThat(StandoutRules.battingSuggestions(batters, null)).containsExactly("known");
    }

    // ---- bowling ----

    @Test
    void bowlersAreRankedByWicketsThenEconomyAndOnlyTheTopThreeCanBeSuggested() {
        List<Bowler<String>> bowlers = List.of(
                new Bowler<>("a", 24, 30, 2), new Bowler<>("b", 24, 20, 2), new Bowler<>("c", 24, 50, 3),
                new Bowler<>("d", 24, 40, 1));

        // c (3 wickets), then b (2, cheaper), then a (2); d is fourth with a wicket and is left out
        assertThat(StandoutRules.bowlingSuggestions(bowlers, 160, 120)).containsExactlyInAnyOrder("a", "b", "c");
    }

    @Test
    void aBowlerNeedsAWicketOrAnEconomyWellUnderTheInningsRunRate() {
        // the innings ran at 1.0 runs a ball; three quarters of that is 0.75
        assertThat(StandoutRules.bowlingSuggestions(List.of(new Bowler<>("tight", 24, 18, 0)), 120, 120))
                .containsExactly("tight");
        assertThat(StandoutRules.bowlingSuggestions(List.of(new Bowler<>("loose", 24, 19, 0)), 120, 120)).isEmpty();
        // economical enough but too few balls to say so
        assertThat(StandoutRules.bowlingSuggestions(List.of(new Bowler<>("short", 11, 2, 0)), 120, 120)).isEmpty();
        assertThat(StandoutRules.bowlingSuggestions(List.of(new Bowler<>("twelve", 12, 2, 0)), 120, 120))
                .containsExactly("twelve");
    }

    @Test
    void aBowlerWithAWicketIsSuggestedWhateverTheEconomyOrTheInningsFigures() {
        assertThat(StandoutRules.bowlingSuggestions(List.of(new Bowler<>("a", 24, 90, 1)), 120, 120)).containsExactly("a");
        assertThat(StandoutRules.bowlingSuggestions(List.of(new Bowler<>("a", 24, 90, 1)), null, null)).containsExactly("a");
        // without the innings figures the economy rule cannot apply
        assertThat(StandoutRules.bowlingSuggestions(List.of(new Bowler<>("a", 24, 1, 0)), null, null)).isEmpty();
        assertThat(StandoutRules.bowlingSuggestions(List.of(new Bowler<>("a", 24, 1, 0)), 100, 0)).isEmpty();
    }

    @Test
    void aBowlerWithNeitherABallNorAWicketIsNeverSuggested() {
        assertThat(StandoutRules.bowlingSuggestions(List.of(new Bowler<>("a", 0, 0, 0)), 120, 120)).isEmpty();
    }

    @Test
    void aBowlerWithOnlyWicketsAndNoBallsEnteredStillRanksByWicketsWithEconomyUnknown() {
        List<Bowler<String>> bowlers = List.of(new Bowler<>("known", 24, 20, 2), new Bowler<>("wicketsOnly", 0, 0, 2),
                new Bowler<>("one", 24, 10, 1), new Bowler<>("one2", 24, 11, 1));

        // wicketsOnly ties on two wickets but ranks behind the one with a known economy; the top three are kept
        assertThat(StandoutRules.bowlingSuggestions(bowlers, 100, 120)).containsExactlyInAnyOrder("known", "wicketsOnly", "one");
    }

    @Test
    void identicalBowlersAreTakenInListOrderSoTheOutcomeIsStable() {
        List<Bowler<String>> bowlers = List.of(new Bowler<>("a", 24, 30, 1), new Bowler<>("b", 24, 30, 1),
                new Bowler<>("c", 24, 30, 1), new Bowler<>("d", 24, 30, 1));

        assertThat(StandoutRules.bowlingSuggestions(bowlers, 160, 120)).containsExactlyInAnyOrder("a", "b", "c");
    }

    // ---- fielding ----

    @Test
    void aFielderNeedsAtLeastTwoDismissalsAndTheTopThreeAreKept() {
        List<Fielder<String>> fielders = List.of(new Fielder<>("one", 1), new Fielder<>("two", 2), new Fielder<>("four", 4),
                new Fielder<>("three", 3), new Fielder<>("alsoTwo", 2));

        assertThat(StandoutRules.fieldingSuggestions(fielders)).containsExactlyInAnyOrder("two", "four", "three");
        assertThat(StandoutRules.fieldingSuggestions(List.of(new Fielder<>("one", 1), new Fielder<>("none", 0)))).isEmpty();
    }
}
