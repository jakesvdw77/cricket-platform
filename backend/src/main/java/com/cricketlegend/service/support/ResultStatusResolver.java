package com.cricketlegend.service.support;

import com.cricketlegend.domain.MatchResultStatus;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.repository.MatchResultRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * docs/specs/100-match-results-core.md: the one batched answer to "what is the result state of these matches?" for the
 * Matches list and match pages (a match is completed when its result is published). One query for any number of
 * matches; a match with no row is {@link MatchResultStatus#NONE}.
 */
@Component
public class ResultStatusResolver {

    private final MatchResultRepository matchResultRepository;

    public ResultStatusResolver(MatchResultRepository matchResultRepository) {
        this.matchResultRepository = matchResultRepository;
    }

    public Map<UUID, MatchResultStatus> statusesFor(Collection<UUID> matchIds) {
        Map<UUID, MatchResultStatus> byMatch = new HashMap<>();
        if (matchIds.isEmpty()) {
            return byMatch;
        }
        matchResultRepository.findStatusesByMatchIdIn(matchIds).forEach(view -> byMatch.put(
                view.getMatchId(),
                view.getStatus() == ResultStatus.PUBLISHED ? MatchResultStatus.PUBLISHED : MatchResultStatus.DRAFT));
        return byMatch;
    }
}
