package com.cricketlegend.service.support;

/**
 * docs/specs/100-match-results-core.md: the backend's only touch of overs. Everything is stored and calculated as
 * balls; this renders balls for display as {@code overs.balls} (220 balls at 6 per over is {@code 36.4}).
 */
public final class OversFormat {

    private OversFormat() {}

    /** Null when the balls have not been entered. */
    public static String display(Integer balls, int ballsPerOver) {
        if (balls == null) {
            return null;
        }
        return (balls / ballsPerOver) + "." + (balls % ballsPerOver);
    }
}
