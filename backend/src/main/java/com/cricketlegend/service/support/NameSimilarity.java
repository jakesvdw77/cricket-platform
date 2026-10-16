package com.cricketlegend.service.support;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Tier 4 of player-name resolution (docs/specs/104): ranked, typo-tolerant suggestions for a name tiers 1 to 3 did
 * not place. Compares the shared normalised forms (given names then particle-stripped surname, compact) with
 * {@link PlayerNameMatcher#editDistance}. The threshold is deliberately high and nothing here ever links: a
 * suggestion is only an offer the manager can accept with one tap.
 */
public final class NameSimilarity {

    /** A suggestion needs a score at or above this (1 minus edit distance over the longer form). */
    public static final double MIN_SCORE = 0.80;

    /** Forms shorter than this are never suggested: one typo is too large a share of them. */
    static final int MIN_FORM_LENGTH = 5;

    static final int MAX_SUGGESTIONS = 3;

    private NameSimilarity() {}

    /** Up to {@value #MAX_SUGGESTIONS} candidates at or above {@link #MIN_SCORE}, best first (ties by name). */
    public static List<NameSuggestion> rank(String written, List<NameCandidate> candidates) {
        NameTokens typed = NameTokens.of(written);
        if (typed.isEmpty()) {
            return List.of();
        }
        boolean surnameOnly = typed.words().size() == 1;
        List<String> typedForms = new ArrayList<>();
        for (NameTokens.Split split : typed.splits()) {
            for (String form : forms(String.join(" ", split.given()), String.join(" ", split.surname()))) {
                if (!typedForms.contains(form)) {
                    typedForms.add(form);
                }
            }
        }
        List<NameSuggestion> out = new ArrayList<>();
        for (NameCandidate candidate : candidates) {
            List<String> candidateForms = surnameOnly
                    ? forms("", candidate.lastName())
                    : forms(candidate.firstName(), candidate.lastName());
            double best = 0;
            for (String typedForm : typedForms) {
                for (String candidateForm : candidateForms) {
                    best = Math.max(best, score(typedForm, candidateForm));
                }
            }
            if (best >= MIN_SCORE) {
                out.add(new NameSuggestion(candidate, best));
            }
        }
        return out.stream()
                .sorted(Comparator.comparingDouble(NameSuggestion::score).reversed()
                        .thenComparing(s -> s.candidate().fullName()))
                .limit(MAX_SUGGESTIONS)
                .toList();
    }

    /**
     * The compact forms compared: given names then the surname, once with its leading particle stripped and once
     * as written. Both are offered because a stripped form can lose a real syllable ("Dedman" starts with "de").
     */
    private static List<String> forms(String given, String surname) {
        String compactGiven = PlayerNameMatcher.canonical(given);
        String stripped = compactGiven + PlayerNameMatcher.canonicalSurname(surname);
        String whole = compactGiven + PlayerNameMatcher.canonical(surname);
        return stripped.equals(whole) ? List.of(stripped) : List.of(stripped, whole);
    }

    private static double score(String a, String b) {
        int longer = Math.max(a.length(), b.length());
        if (Math.min(a.length(), b.length()) < MIN_FORM_LENGTH) {
            return 0;
        }
        // The small addend keeps an exact-threshold score (2 edits in 10 letters is 0.80) from losing an edit to floating point.
        int allowed = (int) Math.floor((1 - MIN_SCORE) * longer + 1e-9);
        int distance = PlayerNameMatcher.editDistance(a, b, allowed);
        return distance > allowed ? 0 : 1.0 - (double) distance / longer;
    }
}
