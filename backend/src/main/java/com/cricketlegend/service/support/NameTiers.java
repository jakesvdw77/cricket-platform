package com.cricketlegend.service.support;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

/**
 * Tiers 1 to 3 of player-name resolution (docs/specs/104, "The Result Processor", stage 3). Pure: the candidates
 * are handed in, nothing is read or written. Rules run in order, and a rule only counts when it identifies
 * <em>exactly one</em> candidate. A rule that fits two or more is ambiguous: the name moves on to the next rule,
 * and if nothing later places it the result is UNRESOLVED / AMBIGUOUS carrying both candidates. No typo
 * tolerance here (that is {@link NameSimilarity}, which never links).
 *
 * <p>Name words are compared through {@link PlayerNameMatcher}'s canonical forms, so case, accents, spaces,
 * hyphens, apostrophes and dots never matter below tier 1, and one leading surname particle is ignored.
 * Orientation is not assumed: "Smith J" and "J Smith" are both tried.
 */
public final class NameTiers {

    /** Tier 3c needs at least this many surname characters before a prefix counts. */
    static final int MIN_PREFIX_LENGTH = 3;

    private record Rule(NameLevel level, NameReason reason, Predicate<NameCandidate> test) {}

    private record GivenUnit(String text, boolean initial) {}

    private NameTiers() {}

    /** Resolve one written name against a side's candidates by tiers 1 to 3. */
    public static NameResolution resolve(String written, List<NameCandidate> candidates) {
        NameTokens typed = NameTokens.of(written);
        if (typed.isEmpty()) {
            return NameResolution.unresolved(written, NameReason.NO_MATCH, List.of());
        }
        List<NameCandidate> pool = distinct(candidates);
        String trimmed = written.trim();
        List<NameTokens.Split> splits = typed.splits();

        List<Rule> rules = List.of(
                new Rule(NameLevel.EXACT, NameReason.EXACT, c -> trimmed.equals(c.fullName())),
                new Rule(NameLevel.EXACT, NameReason.NORMALISED_EXACT, c -> sameNameDifferentForm(typed, splits.get(0), c)),
                new Rule(NameLevel.NORMALISED, NameReason.NORMALISED, c -> normalisedEqual(typed, splits, c)),
                new Rule(NameLevel.NORMALISED, NameReason.INITIALS, c -> surnameEqualGivenAgrees(splits, c)),
                new Rule(NameLevel.NORMALISED, NameReason.SURNAME_INITIAL, c -> givenWithSurnameInitial(typed, c)),
                new Rule(NameLevel.NORMALISED, NameReason.ABBREVIATED_SURNAME, c -> abbreviatedSurname(splits, c)),
                new Rule(NameLevel.NORMALISED, NameReason.SURNAME_PREFIX, c -> surnamePrefix(splits, c)));

        List<NameCandidate> ambiguous = List.of();
        for (Rule rule : rules) {
            List<NameCandidate> hits = pool.stream().filter(rule.test()).toList();
            if (hits.size() == 1) {
                return NameResolution.matched(written, rule.level(), rule.reason(), hits.get(0));
            }
            if (hits.size() > 1 && ambiguous.isEmpty()) {
                ambiguous = hits;
            }
        }
        return ambiguous.isEmpty()
                ? NameResolution.unresolved(written, NameReason.NO_MATCH, List.of())
                : NameResolution.unresolved(written, NameReason.AMBIGUOUS, ambiguous);
    }

    /**
     * Tier 1b (EXACT, reason NORMALISED_EXACT): the same words in the same order, differing only in case, accents,
     * spacing, punctuation or the form of the surname particle ("vd", "van der", "van den", "vdW" are equivalent,
     * "De Vries" is "de Vries"). The particle must be present on both sides or neither: dropping it is a
     * guess, left to tier 2. The abbreviated "vdW" form only counts with the full given name present and equal.
     */
    private static boolean sameNameDifferentForm(NameTokens typed, NameTokens.Split split, NameCandidate c) {
        String first = PlayerNameMatcher.canonical(c.firstName());
        String last = PlayerNameMatcher.canonical(c.lastName());
        if (first.isEmpty() || last.isEmpty() || typed.words().size() < 2) {
            return false;
        }
        if (PlayerNameMatcher.canonical(typed.joined()).equals(first + last)) {
            return true;
        }
        if (split.given().isEmpty() || split.surname().isEmpty()
                || !PlayerNameMatcher.canonical(String.join(" ", split.given())).equals(first)) {
            return false;
        }
        String typedSurname = String.join(" ", split.surname());
        String typedCompact = PlayerNameMatcher.canonical(typedSurname);
        boolean particleOnBoth = typedCompact.equals(PlayerNameMatcher.canonicalSurname(typedSurname))
                == last.equals(PlayerNameMatcher.canonicalSurname(c.lastName()));
        if (particleOnBoth
                && PlayerNameMatcher.canonicalSurname(typedSurname).equals(PlayerNameMatcher.canonicalSurname(c.lastName()))) {
            return true;
        }
        String abbreviation = NameTokens.abbreviatedSurname(c.lastName());
        return !abbreviation.isEmpty() && typedCompact.equals(abbreviation);
    }

    /** Tier 2: given|surname equal in either reading, or the whole compact name equal in either order. */
    private static boolean normalisedEqual(NameTokens typed, List<NameTokens.Split> splits, NameCandidate c) {
        String first = PlayerNameMatcher.canonical(c.firstName());
        String last = PlayerNameMatcher.canonical(c.lastName());
        if (first.isEmpty() || last.isEmpty()) {
            return false;
        }
        if (typed.words().size() >= 2) {
            String whole = PlayerNameMatcher.canonical(typed.joined());
            if (whole.equals(first + last) || whole.equals(last + first)) {
                return true;
            }
        }
        String key = first + "|" + PlayerNameMatcher.canonicalSurname(c.lastName());
        for (NameTokens.Split split : splits) {
            if (!split.given().isEmpty() && !split.surname().isEmpty()
                    && key.equals(PlayerNameMatcher.canonical(String.join(" ", split.given()))
                            + "|" + PlayerNameMatcher.canonicalSurname(String.join(" ", split.surname())))) {
                return true;
            }
        }
        return false;
    }

    /** Tier 3a: surname equals the candidate's, given names present and agreeing as initials or name prefixes. */
    private static boolean surnameEqualGivenAgrees(List<NameTokens.Split> splits, NameCandidate c) {
        String surname = PlayerNameMatcher.canonicalSurname(c.lastName());
        return splits.stream().anyMatch(s -> !s.given().isEmpty() && !s.surname().isEmpty()
                && PlayerNameMatcher.canonicalSurname(String.join(" ", s.surname())).equals(surname)
                && givenAgrees(s.given(), c));
    }

    /**
     * Tier 3 "given name plus surname initial" (the CricClubs form, "Sol V", "Jack V"): exactly two words, the
     * first equal to the candidate's given name and the second one or two letters that start the candidate's main
     * surname or its full compact surname (so the particle's first letter also counts). Runs after the initials
     * rule, so "Nazar A" still reads as surname plus initial whenever that identifies a candidate.
     */
    private static boolean givenWithSurnameInitial(NameTokens typed, NameCandidate c) {
        if (typed.words().size() != 2) {
            return false;
        }
        String given = PlayerNameMatcher.canonical(typed.words().get(0));
        String initial = PlayerNameMatcher.canonical(typed.words().get(1));
        return !given.isEmpty() && initial.length() <= 2
                && given.equals(PlayerNameMatcher.canonical(c.firstName()))
                && (PlayerNameMatcher.canonicalSurname(c.lastName()).startsWith(initial)
                        || PlayerNameMatcher.canonical(c.lastName()).startsWith(initial));
    }

    /** Tier 3b: the surname words are the particle abbreviation ("vdW"), given names if any agreeing. */
    private static boolean abbreviatedSurname(List<NameTokens.Split> splits, NameCandidate c) {
        String abbreviation = NameTokens.abbreviatedSurname(c.lastName());
        return !abbreviation.isEmpty() && splits.stream().anyMatch(s -> !s.surname().isEmpty()
                && PlayerNameMatcher.canonical(String.join(" ", s.surname())).equals(abbreviation)
                && givenAgrees(s.given(), c));
    }

    /** Tier 3c: typed surname of 3+ characters is a prefix of the candidate's, given names if any agreeing. */
    private static boolean surnamePrefix(List<NameTokens.Split> splits, NameCandidate c) {
        String surname = PlayerNameMatcher.canonicalSurname(c.lastName());
        return splits.stream().anyMatch(s -> {
            if (s.surname().isEmpty()) {
                return false;
            }
            String typedSurname = PlayerNameMatcher.canonicalSurname(String.join(" ", s.surname()));
            return typedSurname.length() >= MIN_PREFIX_LENGTH
                    && surname.startsWith(typedSurname)
                    && givenAgrees(s.given(), c);
        });
    }

    /**
     * Typed given words agree with the candidate's given names: each initial is the start of the candidate's
     * given word at that position, each full word is a prefix of it. No typed given words always agrees.
     */
    private static boolean givenAgrees(List<String> typedGiven, NameCandidate c) {
        List<GivenUnit> units = units(typedGiven);
        List<String> candidateGiven = NameTokens.of(c.firstName()).words().stream()
                .map(PlayerNameMatcher::canonical)
                .toList();
        if (units.size() > candidateGiven.size()) {
            return false;
        }
        for (int i = 0; i < units.size(); i++) {
            if (!candidateGiven.get(i).startsWith(units.get(i).text())) {
                return false;
            }
        }
        return true;
    }

    /**
     * "AB" and "Cd" are initial clusters (one letter each), "A" is one initial, "Sam" is a name word. A word of up to
     * three letters is a cluster when it is a single letter, all capitals, or has no vowel; "Jo" and "Ed" stay names.
     */
    private static List<GivenUnit> units(List<String> givenWords) {
        List<GivenUnit> units = new ArrayList<>();
        for (String word : givenWords) {
            String canonical = PlayerNameMatcher.canonical(word);
            if (looksLikeInitials(word, canonical)) {
                canonical.chars().forEach(ch -> units.add(new GivenUnit(String.valueOf((char) ch), true)));
            } else {
                units.add(new GivenUnit(canonical, false));
            }
        }
        return units;
    }

    private static boolean looksLikeInitials(String word, String canonical) {
        if (canonical.length() == 1) {
            return true;
        }
        if (canonical.length() > 3) {
            return false;
        }
        boolean allCapitals = word.chars().filter(Character::isLetter).allMatch(Character::isUpperCase);
        boolean noVowel = canonical.chars().noneMatch(ch -> "aeiouy".indexOf(ch) >= 0);
        return allCapitals || noVowel;
    }

    private static List<NameCandidate> distinct(List<NameCandidate> candidates) {
        Map<Object, NameCandidate> byId = new LinkedHashMap<>();
        for (NameCandidate candidate : candidates) {
            byId.putIfAbsent(candidate.id() == null ? candidate : candidate.id(), candidate);
        }
        return new ArrayList<>(byId.values());
    }
}
