package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchAvailabilityPoll;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** See docs/specs/032-match-availability-polls.md. */
public interface MatchAvailabilityPollRepository extends JpaRepository<MatchAvailabilityPoll, UUID> {

    Optional<MatchAvailabilityPoll> findByMatchIdAndTeamId(UUID matchId, UUID teamId);

    boolean existsByMatchIdAndTeamId(UUID matchId, UUID teamId);

    List<MatchAvailabilityPoll> findByMatchId(UUID matchId);
}
