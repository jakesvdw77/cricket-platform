package com.cricketlegend.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.EnumSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * docs/specs/101-match-results-our-side-scorecard.md Test Plan: wicket classification per {@link DismissalType}. A
 * wicket is everything except not out, did not bat and retired not out; the bowler is credited with the dismissals
 * that are his; the rest are non-bowler wickets (a retired-out batter among them); only some ways out name a fielder.
 */
class DismissalTypeTest {

    private static final Set<DismissalType> NOT_WICKETS =
            EnumSet.of(DismissalType.NOT_OUT, DismissalType.DID_NOT_BAT, DismissalType.RETIRED_NOT_OUT);
    private static final Set<DismissalType> BOWLER_CREDITED = EnumSet.of(
            DismissalType.BOWLED, DismissalType.CAUGHT, DismissalType.CAUGHT_AND_BOWLED, DismissalType.LBW,
            DismissalType.STUMPED, DismissalType.HIT_WICKET);
    private static final Set<DismissalType> NON_BOWLER_WICKETS = EnumSet.of(
            DismissalType.RUN_OUT, DismissalType.HANDLED_BALL, DismissalType.OBSTRUCTING_FIELD,
            DismissalType.HIT_BALL_TWICE, DismissalType.TIMED_OUT, DismissalType.RETIRED_OUT);

    @ParameterizedTest
    @EnumSource(DismissalType.class)
    void everyWayOutIsExactlyOneOfNotAWicketBowlerCreditedOrNonBowler(DismissalType how) {
        int classes = (NOT_WICKETS.contains(how) ? 1 : 0) + (BOWLER_CREDITED.contains(how) ? 1 : 0)
                + (NON_BOWLER_WICKETS.contains(how) ? 1 : 0);
        assertThat(classes).as(how.name()).isEqualTo(1);

        assertThat(how.isWicket()).isEqualTo(!NOT_WICKETS.contains(how));
        assertThat(how.isBowlerCredited()).isEqualTo(BOWLER_CREDITED.contains(how));
        assertThat(how.isNonBowlerWicket()).isEqualTo(NON_BOWLER_WICKETS.contains(how));
        assertThat(how.allowsBowler()).isEqualTo(BOWLER_CREDITED.contains(how));
    }

    @Test
    void aRetiredOutBatterIsACountedNonBowlerWicketAndARetiredNotOutBatterIsNot() {
        assertThat(DismissalType.RETIRED_OUT.isWicket()).isTrue();
        assertThat(DismissalType.RETIRED_OUT.isNonBowlerWicket()).isTrue();
        assertThat(DismissalType.RETIRED_OUT.isBowlerCredited()).isFalse();
        assertThat(DismissalType.RETIRED_NOT_OUT.isWicket()).isFalse();
        assertThat(DismissalType.RETIRED_NOT_OUT.isNonBowlerWicket()).isFalse();
    }

    @Test
    void onlyCaughtStumpedAndRunOutNameAFielder() {
        for (DismissalType how : DismissalType.values()) {
            boolean expected = how == DismissalType.CAUGHT || how == DismissalType.STUMPED || how == DismissalType.RUN_OUT;
            assertThat(how.allowsFielder()).as(how.name()).isEqualTo(expected);
        }
    }

    @Test
    void everyoneBattedExceptTheDidNotBat() {
        for (DismissalType how : DismissalType.values()) {
            assertThat(how.batted()).as(how.name()).isEqualTo(how != DismissalType.DID_NOT_BAT);
        }
    }
}
