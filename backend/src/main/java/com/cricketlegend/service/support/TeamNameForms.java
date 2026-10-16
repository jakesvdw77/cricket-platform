package com.cricketlegend.service.support;

import com.cricketlegend.domain.ResultSide;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * docs/specs/104-match-results-import-adaptors.md, team names across scoring systems: the same team is written as
 * "Irene Villagers U15", "IRENE VILLAGERS Under 15" or "Irene Villagers Under-15". This reads a name as words, with the
 * age group written one way ("u15") and numbers kept as numbers, so two names can be compared without ever treating
 * "Villagers 1" and "Villagers 2" as the same side. Pure functions, no state.
 */
public final class TeamNameForms {

    private static final Pattern AGE_GLUED = Pattern.compile("^(?:u|under)(\\d{1,2})$");
    private static final Pattern NUMBER = Pattern.compile("^\\d+$");
    /** A closest-side hint needs at least this similarity (the same bar as a player-name suggestion). */
    private static final double HINT_MIN_SCORE = NameSimilarity.MIN_SCORE;
    private static final Set<String> AGE_WORDS = Set.of("u", "under");

    /** A closest side and how close it was. */
    public record Closest(ResultSide side, double score) {}

    private TeamNameForms() {}

    /** The name as lower case words: accents removed, punctuation as a space, "Under 15" and "U-15" both "u15". */
    public static List<String> words(String name) {
        if (name == null) {
            return List.of();
        }
        // Dots and apostrophes join letters ("C.B.C." is "cbc", "St. John's" is "st johns"); anything else separates words.
        String plain = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}+", "").replaceAll("[.'’`‘]", "");
        List<String> raw = new ArrayList<>();
        for (String word : plain.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+")) {
            if (!word.isEmpty()) {
                raw.add(word);
            }
        }
        List<String> out = new ArrayList<>();
        for (int i = 0; i < raw.size(); i++) {
            String word = raw.get(i);
            Matcher glued = AGE_GLUED.matcher(word);
            if (glued.matches()) {
                out.add("u" + glued.group(1));
            } else if (AGE_WORDS.contains(word) && i + 1 < raw.size() && NUMBER.matcher(raw.get(i + 1)).matches()) {
                out.add("u" + raw.get(i + 1));
                i++;
            } else {
                out.add(word);
            }
        }
        return out;
    }

    /** The plain numbers in the name ("1" in "Villagers 1"); an age group such as "u15" is not one of them. */
    public static List<String> numbers(List<String> words) {
        return words.stream().filter(w -> NUMBER.matcher(w).matches()).toList();
    }

    private static List<String> ageGroups(List<String> words) {
        return words.stream().filter(w -> w.matches("u\\d{1,2}")).toList();
    }

    /**
     * Whether two names could be the same team: the same numbers and the same age group. A name with a number never
     * matches one without, or one with another number, however alike the rest is.
     */
    public static boolean compatible(String a, String b) {
        List<String> wa = words(a);
        List<String> wb = words(b);
        return numbers(wa).equals(numbers(wb)) && ageGroups(wa).equals(ageGroups(wb));
    }

    /** The two names are the same words once the age group is written one way (and they are not already identical). */
    public static boolean sameWords(String a, String b) {
        List<String> wa = words(a);
        return !wa.isEmpty() && wa.equals(words(b));
    }

    /**
     * Which of the two sides a name is closest to, as a hint only (nothing is linked from it): compatible names only, at
     * or above {@link #HINT_MIN_SCORE}, and clearly better than the other side. Empty when it cannot tell.
     */
    public static Optional<Closest> closest(String written, String homeName, String awayName) {
        double home = score(written, homeName);
        double away = score(written, awayName);
        double best = Math.max(home, away);
        if (best < HINT_MIN_SCORE || Math.abs(home - away) < 0.05) {
            return Optional.empty();
        }
        return Optional.of(new Closest(home > away ? ResultSide.HOME : ResultSide.AWAY, best));
    }

    private static double score(String written, String side) {
        if (side == null || !compatible(written, side)) {
            return 0;
        }
        List<String> a = words(written);
        List<String> b = words(side);
        if (a.isEmpty() || b.isEmpty()) {
            return 0;
        }
        String ja = String.join("", a);
        String jb = String.join("", b);
        int longer = Math.max(ja.length(), jb.length());
        int allowed = (int) Math.floor((1 - HINT_MIN_SCORE) * longer + 1e-9);
        int distance = PlayerNameMatcher.editDistance(ja, jb, allowed);
        double similarity = distance > allowed ? 0 : 1.0 - (double) distance / longer;
        // Every word of the shorter name in the longer ("Irene Villagers" in "Irene Villagers U15"): a sure hint.
        List<String> shorter = a.size() <= b.size() ? a : b;
        List<String> longerWords = a.size() <= b.size() ? b : a;
        double contained = shorter.size() >= 2 && longerWords.containsAll(shorter) ? 0.85 : 0;
        return Math.max(similarity, contained);
    }
}
