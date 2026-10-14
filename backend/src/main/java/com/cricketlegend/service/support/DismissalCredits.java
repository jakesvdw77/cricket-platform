package com.cricketlegend.service.support;

import com.cricketlegend.domain.DismissalType;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

/**
 * docs/specs/101: the credits a set of dismissals gives the bowlers and fielders, as one pure function shared by the
 * save (which recomputes {@code DERIVED} rows), the validator (which compares {@code MANUAL} rows) and, later, the
 * imports. {@code K} is however the caller identifies a player (an id, or a client key before the player is stored).
 *
 * <p>Per innings, over that innings' batting entries: a bowler's {@code wickets} are the bowler-credited dismissals
 * naming him; a fielder's {@code catches} are the caught dismissals naming him, plus a caught-and-bowled for the
 * bowler; {@code stumpings} are the stumped dismissals naming the fielder; {@code runOuts} the run-outs naming the
 * fielder. A dismissal that names nobody credits nobody.
 */
public final class DismissalCredits {

    private DismissalCredits() {}

    /** One batter's dismissal: how, and the bowler and fielder when recorded (null otherwise). */
    public record Dismissal<K>(DismissalType howOut, K bowler, K fielder) {}

    /** What the dismissals credit one player. */
    public record Credit(int wickets, int catches, int stumpings, int runOuts) {

        public static final Credit NONE = new Credit(0, 0, 0, 0);

        /** True when the player has a fielding credit (a catch, a stumping or a run-out). */
        public boolean hasFielding() {
            return catches > 0 || stumpings > 0 || runOuts > 0;
        }

        Credit plus(int wickets, int catches, int stumpings, int runOuts) {
            return new Credit(this.wickets + wickets, this.catches + catches, this.stumpings + stumpings,
                    this.runOuts + runOuts);
        }
    }

    /** The credit of every player named on a dismissal; a player not named is absent (use {@link Credit#NONE}). */
    public static <K> Map<K, Credit> derive(Collection<Dismissal<K>> dismissals) {
        Map<K, Credit> credits = new HashMap<>();
        for (Dismissal<K> d : dismissals) {
            DismissalType how = d.howOut();
            if (how == null) {
                continue;
            }
            if (how.isBowlerCredited() && d.bowler() != null) {
                credits.merge(d.bowler(), Credit.NONE.plus(1, how == DismissalType.CAUGHT_AND_BOWLED ? 1 : 0, 0, 0),
                        (a, b) -> a.plus(b.wickets, b.catches, b.stumpings, b.runOuts));
            }
            if (d.fielder() != null && how.allowsFielder()) {
                Credit c = Credit.NONE.plus(0, how == DismissalType.CAUGHT ? 1 : 0, how == DismissalType.STUMPED ? 1 : 0,
                        how == DismissalType.RUN_OUT ? 1 : 0);
                credits.merge(d.fielder(), c, (a, b) -> a.plus(b.wickets, b.catches, b.stumpings, b.runOuts));
            }
        }
        return credits;
    }

    /** True when every bowler-credited dismissal names its bowler, so bowlers' wickets are fully attributed. */
    public static <K> boolean wicketsAttributed(Collection<Dismissal<K>> dismissals) {
        return dismissals.stream()
                .filter(d -> d.howOut() != null && d.howOut().isBowlerCredited())
                .allMatch(d -> d.bowler() != null);
    }

    /** True when every catch can be credited: each caught names its fielder, each caught-and-bowled its bowler. */
    public static <K> boolean catchesAttributed(Collection<Dismissal<K>> dismissals) {
        return dismissals.stream().allMatch(d -> d.howOut() != DismissalType.CAUGHT || d.fielder() != null)
                && dismissals.stream().allMatch(d -> d.howOut() != DismissalType.CAUGHT_AND_BOWLED || d.bowler() != null);
    }

    /** True when every stumping names its fielder. */
    public static <K> boolean stumpingsAttributed(Collection<Dismissal<K>> dismissals) {
        return dismissals.stream().allMatch(d -> d.howOut() != DismissalType.STUMPED || d.fielder() != null);
    }

    /** True when every run-out names its fielder. */
    public static <K> boolean runOutsAttributed(Collection<Dismissal<K>> dismissals) {
        return dismissals.stream().allMatch(d -> d.howOut() != DismissalType.RUN_OUT || d.fielder() != null);
    }
}
