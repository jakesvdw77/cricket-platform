package com.cricketlegend.service.support;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * Closed-world resolution of a dismissal's text (docs/specs/104, "matching approach"): for example
 * {@code "c Nazar A b Cd Mescht"} is read against the names the report's own batting and bowling lists already
 * established, and at each position the <em>longest</em> known name that fits wins, so "Nazar A" is never read as
 * the shorter "Nazar". Only the report's own spellings can be found; nothing from our data is involved. A name
 * after a standalone {@code b} is the bowler, any other is the fielder. A standalone {@code b} is read as the
 * keyword whenever a known name follows it.
 */
public final class DismissalNames {

    /** Dismissal vocabulary that is neither a name nor worth reporting as unmatched. */
    private static final Set<String> KEYWORDS = Set.of(
            "c", "ct", "st", "b", "lbw", "run", "out", "ro", "and", "&", "not", "hit", "wicket", "obstructing",
            "field", "handled", "ball", "timed", "retired", "hurt", "caught", "bowled", "stumped", "sub");

    public enum Role { FIELDER, BOWLER }

    /** A known name found in the text, as spelt in the report's own list, and the role the text gives it. */
    public record Mention(String name, Role role) {}

    /** The names found in order, and the words that were neither a known name nor dismissal vocabulary. */
    public record Result(List<Mention> mentions, List<String> unmatched) {

        public Result {
            mentions = List.copyOf(mentions);
            unmatched = List.copyOf(unmatched);
        }

        /** The first bowler named, or null. */
        public String bowler() {
            return nameFor(Role.BOWLER);
        }

        /** The first fielder named, or null. */
        public String fielder() {
            return nameFor(Role.FIELDER);
        }

        private String nameFor(Role role) {
            return mentions.stream().filter(m -> m.role() == role).map(Mention::name).findFirst().orElse(null);
        }
    }

    private record Known(String name, List<String> canonicalWords) {}

    private DismissalNames() {}

    public static Result resolve(String dismissalText, Collection<String> knownNames) {
        List<Known> known = knownNames.stream()
                .map(name -> new Known(name, canonicalWords(name)))
                .filter(k -> !k.canonicalWords().isEmpty())
                .sorted(Comparator.comparingInt((Known k) -> k.canonicalWords().size()).reversed()
                        .thenComparing(Comparator.comparingInt((Known k) -> String.join("", k.canonicalWords()).length())
                                .reversed()))
                .toList();
        List<String> words = NameTokens.of(dismissalText).words();
        List<String> canonical = words.stream().map(PlayerNameMatcher::canonical).toList();

        List<Mention> mentions = new ArrayList<>();
        List<String> unmatched = new ArrayList<>();
        int i = 0;
        while (i < words.size()) {
            boolean bowlerKeyword = canonical.get(i).equals("b") && longestAt(known, canonical, i + 1) != null;
            Known hit = bowlerKeyword ? null : longestAt(known, canonical, i);
            if (hit != null) {
                boolean afterB = i > 0 && canonical.get(i - 1).equals("b");
                mentions.add(new Mention(hit.name(), afterB ? Role.BOWLER : Role.FIELDER));
                i += hit.canonicalWords().size();
            } else {
                if (!KEYWORDS.contains(words.get(i).toLowerCase(java.util.Locale.ROOT))) {
                    unmatched.add(words.get(i));
                }
                i++;
            }
        }
        return new Result(mentions, unmatched);
    }

    private static List<String> canonicalWords(String name) {
        return NameTokens.of(name).words().stream().map(PlayerNameMatcher::canonical).toList();
    }

    /** The longest known name whose words equal the text's words from {@code start}; known is longest first. */
    private static Known longestAt(List<Known> known, List<String> canonical, int start) {
        for (Known candidate : known) {
            int length = candidate.canonicalWords().size();
            if (start + length <= canonical.size()
                    && canonical.subList(start, start + length).equals(candidate.canonicalWords())) {
                return candidate;
            }
        }
        return null;
    }
}
