package com.cricketlegend.service.support;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

/**
 * Lenient player-name matching for the public availability form (docs/specs/077). A lenient name
 * only ever produces <em>candidates</em>; the date of birth is the real check.
 *
 * <p>Canonical form (applied identically to typed and stored names): lower case, accents removed,
 * spaces, hyphens, apostrophes and dots removed. A surname additionally loses one leading particle
 * (longest first: vander, vanden, vande, vd, van, von, de, du, le, la, di, da) from its compact form.
 * Two canonical strings match when their edit distance is within a tolerance set by the shorter
 * string: 0 below 5 characters, 1 from 5, 2 from 10.
 */
public final class PlayerNameMatcher {

    /** Longest first, so {@code vander} is tried before {@code van}. */
    private static final List<String> SURNAME_PARTICLES = List.of(
            "vanden", "vander", "vande", "van", "von", "vd", "de", "du", "le", "la", "di", "da");

    private PlayerNameMatcher() {}

    /** Lower case, no diacritics, no spaces/hyphens/apostrophes/dots. */
    public static String canonical(String name) {
        if (name == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(name.trim(), Normalizer.Form.NFD);
        StringBuilder out = new StringBuilder(decomposed.length());
        decomposed.codePoints().forEach(cp -> {
            int type = Character.getType(cp);
            boolean mark = type == Character.NON_SPACING_MARK
                    || type == Character.COMBINING_SPACING_MARK
                    || type == Character.ENCLOSING_MARK;
            boolean dropped = Character.isWhitespace(cp) || cp == '-' || cp == '\'' || cp == '.'
                    || cp == '’' || cp == '‘' || cp == '‐' || cp == '‑' || cp == '`';
            if (!mark && !dropped) {
                out.appendCodePoint(cp);
            }
        });
        return out.toString().toLowerCase(Locale.ROOT);
    }

    /** {@link #canonical} with one leading surname particle removed (when something remains). */
    public static String canonicalSurname(String surname) {
        String compact = canonical(surname);
        for (String particle : SURNAME_PARTICLES) {
            if (compact.startsWith(particle) && compact.length() > particle.length()) {
                return compact.substring(particle.length());
            }
        }
        return compact;
    }

    /**
     * The canonical compact first-name-plus-surname form of a typed name, with particles stripped
     * and no typo tolerance: the basis of the attempt-lock key, so spelling variants share a counter.
     */
    public static String lockForm(String firstName, String lastName) {
        return canonical(firstName) + "|" + canonicalSurname(lastName);
    }

    /** True when both first name and surname match leniently. */
    public static boolean matches(
            String typedFirst, String typedLast, String storedFirst, String storedLast) {
        return withinTolerance(canonical(typedFirst), canonical(storedFirst))
                && withinTolerance(canonicalSurname(typedLast), canonicalSurname(storedLast));
    }

    static boolean withinTolerance(String a, String b) {
        if (a.isEmpty() || b.isEmpty()) {
            return false;
        }
        int shorter = Math.min(a.length(), b.length());
        int allowed = shorter >= 10 ? 2 : shorter >= 5 ? 1 : 0;
        return editDistance(a, b, allowed) <= allowed;
    }

    /** Levenshtein distance; stops early with {@code limit + 1} when the length gap alone exceeds it. */
    static int editDistance(String a, String b, int limit) {
        if (Math.abs(a.length() - b.length()) > limit) {
            return limit + 1;
        }
        int[] previous = new int[b.length() + 1];
        int[] current = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            previous[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            current[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                current[j] = Math.min(Math.min(current[j - 1] + 1, previous[j] + 1), previous[j - 1] + cost);
            }
            int[] swap = previous;
            previous = current;
            current = swap;
        }
        return previous[b.length()];
    }
}
