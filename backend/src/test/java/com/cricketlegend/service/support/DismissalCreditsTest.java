package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.service.support.DismissalCredits.Credit;
import com.cricketlegend.service.support.DismissalCredits.Dismissal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * docs/specs/101-match-results-our-side-scorecard.md Test Plan: the {@link DismissalCredits} matrix, one case per
 * {@link DismissalType}, grouping per player, and the "fully attributed" predicates the validator's skips rely on.
 */
class DismissalCreditsTest {

    @SafeVarargs
    private static Map<String, Credit> derive(Dismissal<String>... dismissals) {
        return DismissalCredits.derive(List.of(dismissals));
    }

    private static Dismissal<String> d(DismissalType how, String bowler, String fielder) {
        return new Dismissal<>(how, bowler, fielder);
    }

    @Test
    void aBowledGivesTheBowlerAWicketAndNothingElse() {
        assertThat(derive(d(DismissalType.BOWLED, "bowler", null))).containsExactly(
                Map.entry("bowler", new Credit(1, 0, 0, 0)));
    }

    @Test
    void aCaughtGivesTheBowlerAWicketAndTheFielderACatch() {
        assertThat(derive(d(DismissalType.CAUGHT, "bowler", "fielder")))
                .containsEntry("bowler", new Credit(1, 0, 0, 0))
                .containsEntry("fielder", new Credit(0, 1, 0, 0))
                .hasSize(2);
    }

    @Test
    void aCaughtAndBowledGivesTheBowlerAWicketAndACatch() {
        assertThat(derive(d(DismissalType.CAUGHT_AND_BOWLED, "bowler", null))).containsExactly(
                Map.entry("bowler", new Credit(1, 1, 0, 0)));
    }

    @Test
    void aStumpedGivesTheBowlerAWicketAndTheKeeperAStumping() {
        assertThat(derive(d(DismissalType.STUMPED, "bowler", "keeper")))
                .containsEntry("bowler", new Credit(1, 0, 0, 0))
                .containsEntry("keeper", new Credit(0, 0, 1, 0));
    }

    @Test
    void aRunOutGivesTheFielderARunOutAndNoBowlerAWicket() {
        // even if a bowler were wrongly named on it, a run-out is not his wicket
        assertThat(derive(d(DismissalType.RUN_OUT, "bowler", "fielder")))
                .containsExactly(Map.entry("fielder", new Credit(0, 0, 0, 1)));
    }

    @ParameterizedTest
    @EnumSource(value = DismissalType.class, names = {"LBW", "HIT_WICKET"})
    void lbwAndHitWicketGiveTheBowlerAWicketOnly(DismissalType how) {
        assertThat(derive(d(how, "bowler", "fielder"))).containsExactly(Map.entry("bowler", new Credit(1, 0, 0, 0)));
    }

    @ParameterizedTest
    @EnumSource(value = DismissalType.class, names = {"NOT_OUT", "DID_NOT_BAT", "RETIRED_NOT_OUT", "RETIRED_OUT",
        "HANDLED_BALL", "OBSTRUCTING_FIELD", "HIT_BALL_TWICE", "TIMED_OUT"})
    void theOtherWaysOutCreditNobody(DismissalType how) {
        assertThat(derive(d(how, "bowler", "fielder"))).isEmpty();
    }

    @Test
    void aDismissalThatNamesNobodyCreditsNobodyAndOneWithNoWayOutIsSkipped() {
        assertThat(derive(d(DismissalType.CAUGHT, null, null), d(DismissalType.BOWLED, null, null),
                d(null, "bowler", "fielder"))).isEmpty();
    }

    @Test
    void creditsAreGroupedPerPlayerAcrossDismissals() {
        Map<String, Credit> credits = derive(
                d(DismissalType.BOWLED, "ann", null),
                d(DismissalType.CAUGHT, "ann", "bob"),
                d(DismissalType.CAUGHT_AND_BOWLED, "ann", null),
                d(DismissalType.STUMPED, "cal", "bob"),
                d(DismissalType.RUN_OUT, null, "bob"),
                d(DismissalType.LBW, "cal", null));

        assertThat(credits).containsOnlyKeys("ann", "bob", "cal")
                .containsEntry("ann", new Credit(3, 1, 0, 0))
                .containsEntry("bob", new Credit(0, 1, 1, 1))
                .containsEntry("cal", new Credit(2, 0, 0, 0));
    }

    @Test
    void aPlayerWhoBowlsAndFieldsGetsBothKindsOfCredit() {
        assertThat(derive(d(DismissalType.BOWLED, "ann", null), d(DismissalType.CAUGHT, "bob", "ann")))
                .containsEntry("ann", new Credit(1, 1, 0, 0));
    }

    @Test
    void hasFieldingIsTrueForACatchAStumpingOrARunOutButNotForWicketsAlone() {
        assertThat(new Credit(3, 0, 0, 0).hasFielding()).isFalse();
        assertThat(Credit.NONE.hasFielding()).isFalse();
        assertThat(new Credit(0, 1, 0, 0).hasFielding()).isTrue();
        assertThat(new Credit(0, 0, 1, 0).hasFielding()).isTrue();
        assertThat(new Credit(0, 0, 0, 1).hasFielding()).isTrue();
    }

    // ---- attribution ----

    @Test
    void wicketsAreAttributedOnlyWhenEveryBowlerCreditedDismissalNamesItsBowler() {
        assertThat(DismissalCredits.wicketsAttributed(List.of(d(DismissalType.BOWLED, "a", null),
                d(DismissalType.RUN_OUT, null, null), d(DismissalType.NOT_OUT, null, null)))).isTrue();
        assertThat(DismissalCredits.wicketsAttributed(List.of(d(DismissalType.BOWLED, "a", null),
                d(DismissalType.LBW, null, null)))).isFalse();
        assertThat(DismissalCredits.wicketsAttributed(List.<Dismissal<String>>of())).isTrue();
    }

    @Test
    void catchesNeedTheFielderOfACaughtAndTheBowlerOfACaughtAndBowled() {
        assertThat(DismissalCredits.catchesAttributed(List.of(d(DismissalType.CAUGHT, "a", "f"),
                d(DismissalType.CAUGHT_AND_BOWLED, "a", null)))).isTrue();
        assertThat(DismissalCredits.catchesAttributed(List.of(d(DismissalType.CAUGHT, "a", null)))).isFalse();
        assertThat(DismissalCredits.catchesAttributed(List.of(d(DismissalType.CAUGHT_AND_BOWLED, null, null)))).isFalse();
    }

    @Test
    void stumpingsAndRunOutsNeedTheirFielder() {
        assertThat(DismissalCredits.stumpingsAttributed(List.of(d(DismissalType.STUMPED, "a", "k")))).isTrue();
        assertThat(DismissalCredits.stumpingsAttributed(List.of(d(DismissalType.STUMPED, "a", null)))).isFalse();
        assertThat(DismissalCredits.stumpingsAttributed(List.of(d(DismissalType.RUN_OUT, null, null)))).isTrue();
        assertThat(DismissalCredits.runOutsAttributed(List.of(d(DismissalType.RUN_OUT, null, "f")))).isTrue();
        assertThat(DismissalCredits.runOutsAttributed(List.of(d(DismissalType.RUN_OUT, null, null)))).isFalse();
        assertThat(DismissalCredits.runOutsAttributed(List.of(d(DismissalType.STUMPED, "a", null)))).isTrue();
    }
}
