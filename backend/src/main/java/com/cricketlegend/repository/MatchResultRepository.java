package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.ResultStatus;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * docs/specs/100-match-results-core.md. Only the result services (and {@code ResultStatusResolver}) use this; any read
 * on a path reachable by a role that cannot capture results must go through {@link ResultVisibility}.
 */
public interface MatchResultRepository extends JpaRepository<MatchResult, UUID>, JpaSpecificationExecutor<MatchResult> {

    Optional<MatchResult> findByMatchId(UUID matchId);

    List<MatchResult> findAllByMatchIdIn(Collection<UUID> matchIds);

    /** docs/specs/104: the result a provider's match id was imported onto (unique per club by {@code ux_match_result_source_external}). */
    Optional<MatchResult> findByClubIdAndSourceAndExternalId(UUID clubId, String source, String externalId);

    /** A match's result status without loading the result: the Matches list reads this for a whole page. */
    interface MatchStatusView {
        UUID getMatchId();

        ResultStatus getStatus();
    }

    @Query("select r.matchId as matchId, r.status as status from MatchResult r where r.matchId in :matchIds")
    List<MatchStatusView> findStatusesByMatchIdIn(@Param("matchIds") Collection<UUID> matchIds);
}
