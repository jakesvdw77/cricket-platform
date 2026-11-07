package com.cricketlegend.service.support;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.exception.ValidationException;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;

/**
 * docs/specs/147, "MyStatsInningsPageDto": the fixed set of drill filters of the Player Hub match drill, and which rows of
 * a kind each one keeps. Pure (no Spring, repository, entity, caller or access information). The tokens are advertised by
 * the {@code MyStatsDto} payload beside every drillable figure, so the client builds none of its own; an unknown kind, an
 * unknown filter or a filter that does not apply to the kind is a {@link ValidationException} (400). The thresholds are the
 * platform's fixed definitions (30+ and the score bands), never the age-band guide lines.
 */
public final class StatsDrillFilter {

    /** What a drill lists: batting innings, bowling spells, matches with fielding credits, or whole matches. */
    public enum Kind {
        BATTING("Batting innings"),
        BOWLING("Bowling spells"),
        FIELDING("Fielding"),
        MATCHES("Matches");

        private final String title;

        Kind(String title) {
            this.title = title;
        }

        public String title() {
            return title;
        }
    }

    /** One filter token, the kinds it applies to and a plain label. */
    public enum Filter {
        BAND_0_9("Scores of 0 to 9", Kind.BATTING),
        BAND_10_29("Scores of 10 to 29", Kind.BATTING),
        BAND_30_49("Scores of 30 to 49", Kind.BATTING),
        BAND_50_PLUS("Scores of 50 and more", Kind.BATTING),
        FIRST_INNINGS("Batting first", Kind.BATTING),
        SECOND_INNINGS("Chasing", Kind.BATTING),
        NOT_OUT("Not out", Kind.BATTING),
        OUT_BOWLED("Bowled", Kind.BATTING),
        OUT_CAUGHT("Caught", Kind.BATTING),
        OUT_CAUGHT_AND_BOWLED("Caught and bowled", Kind.BATTING),
        OUT_LBW("LBW", Kind.BATTING),
        OUT_STUMPED("Stumped", Kind.BATTING),
        OUT_RUN_OUT("Run out", Kind.BATTING),
        OUT_HIT_WICKET("Hit wicket", Kind.BATTING),
        OUT_HANDLED_BALL("Handled the ball", Kind.BATTING),
        OUT_OBSTRUCTING_FIELD("Obstructing the field", Kind.BATTING),
        OUT_HIT_BALL_TWICE("Hit the ball twice", Kind.BATTING),
        OUT_TIMED_OUT("Timed out", Kind.BATTING),
        OUT_RETIRED_OUT("Retired out", Kind.BATTING),
        SCORED_30_PLUS("Scored 30 or more", Kind.BATTING, Kind.MATCHES),
        UNDER_30("Did not score 30", Kind.MATCHES),
        WICKETS("Spells with a wicket", Kind.BOWLING),
        THREE_WICKETS_PLUS("Three or more wickets", Kind.BOWLING),
        CATCHES("Catches", Kind.FIELDING),
        STUMPINGS("Stumpings", Kind.FIELDING),
        RUN_OUTS("Run-outs", Kind.FIELDING);

        private final String label;
        private final Set<Kind> kinds;

        Filter(String label, Kind first, Kind... more) {
            this.label = label;
            this.kinds = EnumSet.of(first, more);
        }

        public String label() {
            return label;
        }

        public boolean appliesTo(Kind kind) {
            return kinds.contains(kind);
        }
    }

    /** A batted innings as the filters see it. {@code runs} may be null when the row stored none. */
    public record BattingSubject(int inningsSequence, Integer runs, boolean notOut, DismissalType howOut) {
    }

    /** A bowling spell as the filters see it. */
    public record BowlingSubject(int wickets) {
    }

    /** The stored fielding credits of one match. */
    public record FieldingSubject(long catches, long stumpings, long runOuts) {
    }

    /** A counted match: the best score of any innings in it, or null when the player did not bat with a recorded score. */
    public record MatchSubject(Integer bestScore, boolean battingCardCaptured) {
    }

    private StatsDrillFilter() {}

    /** The drill token of an out dismissal, e.g. {@code OUT_BOWLED}; {@code NOT_OUT} for both not-out kinds. */
    public static String dismissalToken(DismissalType type) {
        return type == DismissalType.NOT_OUT || type == DismissalType.RETIRED_NOT_OUT
                ? Filter.NOT_OUT.name()
                : "OUT_" + type.name();
    }

    /** The kind named in the request; blank or unknown is a 400. */
    public static Kind parseKind(String text) {
        if (text == null || text.isBlank()) {
            throw new ValidationException("kind must be one of " + Arrays.toString(Kind.values()) + ".");
        }
        try {
            return Kind.valueOf(text.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ValidationException("kind must be one of " + Arrays.toString(Kind.values()) + ".");
        }
    }

    /** The optional filter named in the request (null when blank); unknown, or not valid for the kind, is a 400. */
    public static Filter parseFilter(Kind kind, String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Filter filter;
        try {
            filter = Filter.valueOf(text.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ValidationException("filter is not one of the values the stats payload offers.");
        }
        if (!filter.appliesTo(kind)) {
            throw new ValidationException("filter does not apply to kind " + kind.name() + ".");
        }
        return filter;
    }

    public static boolean keeps(Filter filter, BattingSubject innings) {
        if (filter == null) {
            return true;
        }
        Integer runs = innings.runs();
        return switch (filter) {
            case BAND_0_9 -> runs != null && runs >= 0 && runs <= 9;
            case BAND_10_29 -> runs != null && runs >= 10 && runs <= 29;
            case BAND_30_49 -> runs != null && runs >= 30 && runs <= 49;
            case BAND_50_PLUS -> runs != null && runs >= 50;
            case FIRST_INNINGS -> innings.inningsSequence() == 1;
            case SECOND_INNINGS -> innings.inningsSequence() == 2;
            case NOT_OUT -> innings.notOut();
            case SCORED_30_PLUS -> runs != null && runs >= PlayerStatsCalculator.THIRTY_PLUS;
            default -> filter.name().startsWith("OUT_")
                    && innings.howOut() != null
                    && filter.name().equals(dismissalToken(innings.howOut()));
        };
    }

    public static boolean keeps(Filter filter, BowlingSubject spell) {
        if (filter == null) {
            return true;
        }
        return switch (filter) {
            case WICKETS -> spell.wickets() >= 1;
            case THREE_WICKETS_PLUS -> spell.wickets() >= 3;
            default -> false;
        };
    }

    public static boolean keeps(Filter filter, FieldingSubject fielding) {
        if (filter == null) {
            return fielding.catches() + fielding.stumpings() + fielding.runOuts() > 0;
        }
        return switch (filter) {
            case CATCHES -> fielding.catches() > 0;
            case STUMPINGS -> fielding.stumpings() > 0;
            case RUN_OUTS -> fielding.runOuts() > 0;
            default -> false;
        };
    }

    public static boolean keeps(Filter filter, MatchSubject match) {
        if (filter == null) {
            return true;
        }
        boolean scored = match.bestScore() != null && match.bestScore() >= PlayerStatsCalculator.THIRTY_PLUS;
        return switch (filter) {
            case SCORED_30_PLUS -> scored;
            case UNDER_30 -> match.battingCardCaptured() && !scored;
            default -> false;
        };
    }
}
