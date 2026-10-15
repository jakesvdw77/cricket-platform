package com.cricketlegend.service.support;

import java.util.List;

/**
 * Tiers 1 to 4 for one written name: {@link NameTiers} first, and for a name left UNRESOLVED the ranked
 * {@link NameSimilarity} suggestions attached. The one entry point the processor calls per name.
 */
public final class NameResolver {

    private NameResolver() {}

    public static NameResolution resolve(String written, List<NameCandidate> candidates) {
        NameResolution placed = NameTiers.resolve(written, candidates);
        return placed.isLinked() ? placed : placed.withSuggestions(NameSimilarity.rank(written, candidates));
    }
}
