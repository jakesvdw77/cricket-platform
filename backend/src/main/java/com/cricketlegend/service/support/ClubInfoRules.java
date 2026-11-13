package com.cricketlegend.service.support;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

/**
 * docs/specs/148-player-hub-club-info.md: the small pure rules of the Club info reads (no Spring, no access
 * information), so they are unit-testable on their own.
 */
public final class ClubInfoRules {

    /** The "other" bucket of the A to Z strip: a last name not starting with A to Z. */
    public static final String OTHER_LETTER = "#";

    private static final char ESCAPE = '!';

    private ClubInfoRules() {
    }

    /** The trimmed url when it is a well-formed {@code https} url with a host, else null (Decision 8: https only). */
    public static String httpsUrl(String url) {
        if (url == null) {
            return null;
        }
        String trimmed = url.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        try {
            URI uri = new URI(trimmed);
            boolean https = "https".equalsIgnoreCase(uri.getScheme());
            return https && uri.getHost() != null && !uri.getHost().isBlank() ? trimmed : null;
        } catch (URISyntaxException e) {
            return null;
        }
    }

    /** The trimmed text, or null when it is null or blank. */
    public static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /** A lower-case {@code LIKE ... ESCAPE '!'} "contains" pattern; a null or blank query matches everything ({@code %}). */
    public static String likePattern(String query) {
        String text = blankToNull(query);
        if (text == null) {
            return "%";
        }
        StringBuilder sb = new StringBuilder("%");
        for (char ch : text.toLowerCase(Locale.ROOT).toCharArray()) {
            if (ch == ESCAPE || ch == '%' || ch == '_') {
                sb.append(ESCAPE);
            }
            sb.append(ch);
        }
        return sb.append('%').toString();
    }

    /** Whether the value is a single letter A to Z (upper case) or {@code #}. */
    public static boolean isLetterFilter(String letter) {
        return letter != null && letter.length() == 1 && (letter.equals(OTHER_LETTER) || (letter.charAt(0) >= 'A' && letter.charAt(0) <= 'Z'));
    }

    /** The distinct letters, A to Z first and {@code #} last. */
    public static List<String> sortedLetters(Collection<String> letters) {
        List<String> sorted = new ArrayList<>(new java.util.TreeSet<>(letters));
        if (sorted.remove(OTHER_LETTER)) {
            sorted.add(OTHER_LETTER);
        }
        return sorted;
    }
}
