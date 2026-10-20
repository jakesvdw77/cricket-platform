package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.service.support.LeaderboardQualification.Defaults;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * docs/specs/103-player-stats.md, "Minimum qualification on the Awards view": with M the busiest player's matches, minimum
 * innings is clamp(ceil(M / 2), 1, 5) and minimum overs clamp(M, 2, 10).
 */
class LeaderboardQualificationTest {

    @ParameterizedTest(name = "M = {0} gives {1} innings and {2} overs")
    @CsvSource({
        "0, 1, 2",
        "1, 1, 2",
        "2, 1, 2",
        "3, 2, 3",
        "4, 2, 4",
        "6, 3, 6",
        "9, 5, 9",
        "10, 5, 10",
        "11, 5, 10",
        "500, 5, 10",
        "100000, 5, 10"
    })
    void clampsInningsAndOversAroundTheBusiestPlayersMatches(long m, int innings, int overs) {
        Defaults defaults = LeaderboardQualification.defaultsFor(m);

        assertThat(defaults.innings()).isEqualTo(innings);
        assertThat(defaults.overs()).isEqualTo(overs);
    }

    @Test
    void aNegativeMatchCountIsTreatedAsNobodyPlayed() {
        assertThat(LeaderboardQualification.defaultsFor(-4)).isEqualTo(new Defaults(1, 2));
    }

    @Test
    void theScopeDefaultsUseTheLargestMatchesAmongThePlayers() {
        var few = PlayerStatsTestData.counters().matches(2).build();
        var busiest = PlayerStatsTestData.counters().matches(6).build();
        var some = PlayerStatsTestData.counters().matches(4).build();

        assertThat(LeaderboardQualification.defaultsForScope(List.of(few, busiest, some)))
                .isEqualTo(new Defaults(3, 6));
    }

    @Test
    void anEmptyScopeGetsTheFloorDefaults() {
        assertThat(LeaderboardQualification.defaultsForScope(List.of())).isEqualTo(new Defaults(1, 2));
    }

    @Test
    void aBoardTakesTheMinimumOfItsKindAndCountingBoardsHaveNone() {
        Defaults defaults = new Defaults(3, 6);

        assertThat(LeaderboardQualification.suggestedFor(LeaderboardBoard.BATTING_AVERAGE, defaults)).isEqualTo(3);
        assertThat(LeaderboardQualification.suggestedFor(LeaderboardBoard.STRIKE_RATE, defaults)).isEqualTo(3);
        assertThat(LeaderboardQualification.suggestedFor(LeaderboardBoard.ECONOMY_RATE, defaults)).isEqualTo(6);
        assertThat(LeaderboardQualification.suggestedFor(LeaderboardBoard.BOWLING_AVERAGE, defaults)).isEqualTo(6);
        assertThat(LeaderboardQualification.suggestedFor(LeaderboardBoard.BOWLING_STRIKE_RATE, defaults)).isEqualTo(6);
        assertThat(LeaderboardQualification.suggestedFor(LeaderboardBoard.MOST_RUNS, defaults)).isNull();
        assertThat(LeaderboardQualification.valueFor(LeaderboardBoard.MOST_WICKETS, 9, 9)).isNull();
        assertThat(LeaderboardQualification.valueFor(LeaderboardBoard.BATTING_AVERAGE, 4, 8)).isEqualTo(4);
        assertThat(LeaderboardQualification.valueFor(LeaderboardBoard.ECONOMY_RATE, 4, 8)).isEqualTo(8);
    }
}
