package com.cricketlegend.service.support;

import java.util.List;

/**
 * The outcome for one written name. When {@code level} is not {@code UNRESOLVED}, {@code candidate} is the
 * linked player. Otherwise {@code candidate} is null, {@code alternatives} carries the candidates in play for an
 * {@code AMBIGUOUS} name ("could be A or B") or the candidate that already holds the link for a
 * {@code COLLISION}, and {@code suggestions} carries the ranked tier 4 suggestions.
 */
public record NameResolution(
        String written,
        NameLevel level,
        NameReason reason,
        NameCandidate candidate,
        List<NameCandidate> alternatives,
        List<NameSuggestion> suggestions) {

    public NameResolution {
        alternatives = alternatives == null ? List.of() : List.copyOf(alternatives);
        suggestions = suggestions == null ? List.of() : List.copyOf(suggestions);
    }

    public static NameResolution matched(
            String written, NameLevel level, NameReason reason, NameCandidate candidate) {
        return new NameResolution(written, level, reason, candidate, List.of(), List.of());
    }

    public static NameResolution unresolved(
            String written, NameReason reason, List<NameCandidate> alternatives) {
        return new NameResolution(written, NameLevel.UNRESOLVED, reason, null, alternatives, List.of());
    }

    public boolean isLinked() {
        return candidate != null;
    }

    public NameResolution withSuggestions(List<NameSuggestion> ranked) {
        return new NameResolution(written, level, reason, candidate, alternatives, ranked);
    }

    /** This row loses its link to {@code holder}, who keeps it: UNRESOLVED, reason COLLISION. */
    NameResolution collidedWith(NameCandidate holder) {
        return new NameResolution(
                written, NameLevel.UNRESOLVED, NameReason.COLLISION, null, List.of(holder), suggestions);
    }
}
