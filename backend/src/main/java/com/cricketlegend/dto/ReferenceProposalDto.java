package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * One unrecognised value (a team name, say) with ranked link proposals (docs/specs/097-import-framework.md,
 * principle 3). {@code step} is {@code IDENTIFY_OURS} or {@code RESOLVE}. A candidate is only {@code preselected} on an
 * exact normalised match or an alias the user already confirmed once. {@code suggestedCreateName} is optional type
 * data (spec 098: the tidied name a CREATE resolution is pre-filled with).
 */
public record ReferenceProposalDto(
        String key,
        String value,
        String step,
        List<Integer> rowNumbers,
        List<Candidate> candidates,
        String suggestedCreateName) {

    public ReferenceProposalDto {
        rowNumbers = rowNumbers == null ? List.of() : rowNumbers;
        candidates = candidates == null ? List.of() : candidates;
    }

    /**
     * {@code confidence} is 0 to 100; {@code reasons} are plain words such as "same name last season". {@code source},
     * {@code seasonLabel} and {@code leagueName} are optional type data (spec 098: where the candidate lives and, for a
     * league team of another season or league, which; the band is derived from {@code confidence}).
     */
    public record Candidate(
            String targetKind,
            UUID targetId,
            String targetName,
            String origin,
            int confidence,
            List<String> reasons,
            boolean preselected,
            String source,
            String seasonLabel,
            String leagueName) {

        public Candidate {
            reasons = reasons == null ? List.of() : reasons;
        }
    }
}
