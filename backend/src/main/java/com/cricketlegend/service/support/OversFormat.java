package com.cricketlegend.service.support;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * docs/specs/100-match-results-core.md: the backend's only touch of overs. Everything is stored and calculated as
 * balls; this renders balls for display as {@code overs.balls} (220 balls at 6 per over is {@code 36.4}).
 * docs/specs/104: {@link #parse} reads the same notation back, mirroring the UI's {@code parseOvers}.
 */
public final class OversFormat {

    private static final Pattern NOTATION = Pattern.compile("^(\\d{1,5})(?:\\.(\\d?))?$");

    private OversFormat() {}

    /** The outcome of {@link #parse}: {@code balls} when valid, else a plain-English {@code error}. */
    public record Parsed(Integer balls, String error) {
        public boolean valid() {
            return error == null;
        }
    }

    /**
     * {@code "36.4"} is 220 balls at 6 per over, {@code "36"} and {@code "36."} are 216. The digit after the point must
     * be a single digit below {@code ballsPerOver}. Never throws; an invalid text carries an error instead.
     */
    public static Parsed parse(String text, int ballsPerOver) {
        String value = text == null ? "" : text.trim();
        if (value.isEmpty()) {
            return new Parsed(null, "Enter the overs, for example 36.4.");
        }
        Matcher match = NOTATION.matcher(value);
        if (!match.matches()) {
            return new Parsed(null, "Overs look like 36 or 36.4.");
        }
        int overs = Integer.parseInt(match.group(1));
        int ball = match.group(2) == null || match.group(2).isEmpty() ? 0 : Integer.parseInt(match.group(2));
        if (ball >= ballsPerOver) {
            return new Parsed(null, "The ball after the point must be 0 to " + (ballsPerOver - 1) + " ("
                    + ballsPerOver + " balls to an over).");
        }
        return new Parsed(overs * ballsPerOver + ball, null);
    }

    /** Null when the balls have not been entered. */
    public static String display(Integer balls, int ballsPerOver) {
        if (balls == null) {
            return null;
        }
        return (balls / ballsPerOver) + "." + (balls % ballsPerOver);
    }
}
