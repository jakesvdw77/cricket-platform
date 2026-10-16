package com.cricketlegend.service.support;

import java.util.List;
import java.util.Map;

/**
 * Extension seam for a later AI tier (docs/specs/104). Interface only: there is no implementation and no bean in
 * this revision, so the processor's {@code List<UnresolvedNameSuggester>} is empty and it behaves exactly as the
 * deterministic tiers alone. Anything a suggester returns would be linked provisionally and held back from
 * publishing until the manager confirms, like any other guess.
 */
public interface UnresolvedNameSuggester {

    /** A suggested candidate and the suggester's confidence in (0, 1]. */
    record Suggestion(NameCandidate candidate, double confidence) {}

    /**
     * For the unresolved names of one side and that side's candidates, the suggestion per name. A name the
     * suggester has no view on is simply absent from the map.
     */
    Map<String, Suggestion> suggest(List<String> unresolvedNames, List<NameCandidate> candidates);
}
