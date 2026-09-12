package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchSidePlayer;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** See docs/specs/029-league-management.md. */
public interface MatchSidePlayerRepository extends JpaRepository<MatchSidePlayer, UUID> {

    List<MatchSidePlayer> findByMatchSideIdOrderByBattingOrderAsc(UUID matchSideId);

    Optional<MatchSidePlayer> findByMatchSideIdAndPlayerProfileId(UUID matchSideId, UUID playerProfileId);

    boolean existsByMatchSideIdAndPlayerProfileId(UUID matchSideId, UUID playerProfileId);

    long countByMatchSideId(UUID matchSideId);

    void deleteByMatchSideIdAndPlayerProfileId(UUID matchSideId, UUID playerProfileId);
}
