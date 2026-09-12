package com.cricketlegend.repository;

import com.cricketlegend.domain.Match;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The first paginated repository in this feature area, per docs/standards/backend.md's pagination
 * rule — a club's match history grows every week across every season, unlike {@code
 * Section}/{@code Team}/{@code Sponsor}'s deliberately small, flat lists. See
 * docs/specs/029-league-management.md.
 */
public interface MatchRepository extends JpaRepository<Match, UUID> {

    Page<Match> findByClubId(UUID clubId, Pageable pageable);
}
