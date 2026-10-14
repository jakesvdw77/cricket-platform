package com.cricketlegend.repository;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.ResultStatus;
import org.springframework.data.jpa.domain.Specification;

/**
 * docs/specs/100-match-results-core.md, the publish gate: a DRAFT result is invisible to anyone who cannot capture
 * results. Every query on {@code match_result} reachable by a non-capturing role (a player, a public page, statistics)
 * must be composed with one of these; the manager results services are the only callers that may skip it.
 */
public final class ResultVisibility {

    private ResultVisibility() {}

    /** All results for a caller who can capture them, only published ones for everyone else. */
    public static Specification<MatchResult> forCaller(boolean canCapture) {
        return canCapture ? Specification.where(null) : published();
    }

    public static Specification<MatchResult> published() {
        return (root, query, cb) -> cb.equal(root.get("status"), ResultStatus.PUBLISHED);
    }

    /** The same gate on a match query: all matches for a capturing caller, only those with a published result otherwise. */
    public static Specification<Match> matchesForCaller(boolean canCapture) {
        return canCapture ? Specification.where(null) : MatchSpecifications.hasResult(ResultStatus.PUBLISHED);
    }
}
