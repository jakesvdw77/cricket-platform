package com.cricketlegend.service.adaptor;

import java.util.Locale;

/**
 * docs/specs/107-match-results-cricclubs-csv-adaptor.md and docs/specs/108-match-results-stumps-pdf-adaptor.md: the one
 * rule both report readers share unchanged, when two spellings of a team name are the same team. Case and runs of
 * spaces are ignored, nothing else, so a winner or a toss team is never matched by a guess.
 */
final class TeamNames {

    private TeamNames() {}

    /** True when the two names are the same ignoring case and runs of spaces. */
    static boolean same(String first, String second) {
        return normal(first).equals(normal(second));
    }

    /** The name trimmed, with runs of white space as one space, in lower case. */
    static String normal(String text) {
        return text.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
}
