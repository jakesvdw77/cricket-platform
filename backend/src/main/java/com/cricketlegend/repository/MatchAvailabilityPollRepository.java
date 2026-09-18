package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchAvailabilityPoll;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** See docs/specs/032-match-availability-polls.md, docs/specs/034-availability-polls-dashboard.md. */
public interface MatchAvailabilityPollRepository extends JpaRepository<MatchAvailabilityPoll, UUID> {

    Optional<MatchAvailabilityPoll> findByMatchIdAndTeamId(UUID matchId, UUID teamId);

    boolean existsByMatchIdAndTeamId(UUID matchId, UUID teamId);

    List<MatchAvailabilityPoll> findByMatchId(UUID matchId);

    /**
     * Every currently-open poll whose owning {@code Match.clubId} equals {@code clubId} — backs
     * the {@code GET /availability-polls/open} dashboard endpoint. A plain JPQL subquery against
     * {@code Match}'s own {@code clubId}, matching this codebase's existing flat-FK style ({@code
     * MatchAvailabilityPoll} stores {@code matchId}/{@code teamId} as raw UUIDs, no mapped {@code
     * @ManyToOne}). See docs/specs/034-availability-polls-dashboard.md's API Contract, JPQL reused
     * verbatim.
     */
    @Query("SELECT p FROM MatchAvailabilityPoll p WHERE p.open = true "
            + "AND p.matchId IN (SELECT m.id FROM Match m WHERE m.clubId = :clubId)")
    List<MatchAvailabilityPoll> findOpenByMatchClubId(@Param("clubId") UUID clubId);
}
