package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchSide;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** See docs/specs/029-league-management.md. */
public interface MatchSideRepository extends JpaRepository<MatchSide, UUID> {

    List<MatchSide> findByMatchId(UUID matchId);

    Optional<MatchSide> findByMatchIdAndTeamId(UUID matchId, UUID teamId);

    boolean existsByMatchIdAndTeamId(UUID matchId, UUID teamId);
}
