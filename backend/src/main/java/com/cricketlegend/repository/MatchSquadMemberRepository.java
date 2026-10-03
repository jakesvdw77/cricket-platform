package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchSquadMember;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The per-fixture squad pool for a group-poll-covered match of a {@link com.cricketlegend.domain.Team} — see
 * docs/specs/063-section-availability-and-flexible-squads.md. {@link
 * #findBySectionAvailabilityWindowIdAndPlayerProfileId} is the Part C "already picked elsewhere"
 * pre-check, the service-layer counterpart to the DB-level {@code
 * (section_availability_window_id, player_profile_id)} unique constraint.
 */
public interface MatchSquadMemberRepository extends JpaRepository<MatchSquadMember, UUID> {

    boolean existsBySectionAvailabilityWindowIdIn(Collection<UUID> sectionAvailabilityWindowIds);

    List<MatchSquadMember> findByMatchIdAndTeamId(UUID matchId, UUID teamId);

    boolean existsByMatchIdAndTeamIdAndPlayerProfileId(UUID matchId, UUID teamId, UUID playerProfileId);

    Optional<MatchSquadMember> findByMatchIdAndTeamIdAndPlayerProfileId(
            UUID matchId, UUID teamId, UUID playerProfileId);

    Optional<MatchSquadMember> findBySectionAvailabilityWindowIdAndPlayerProfileId(
            UUID sectionAvailabilityWindowId, UUID playerProfileId);

    boolean existsByMatchIdAndTeamIdAndJerseyNumberAndIdNot(
            UUID matchId, UUID teamId, Integer jerseyNumber, UUID excludeId);

    void deleteByMatchIdAndTeamIdAndPlayerProfileId(UUID matchId, UUID teamId, UUID playerProfileId);

    /**
     * Removes every match-squad row picked against these windows (docs/specs/076-team-selection.md:
     * deleting a group poll no longer refuses because of them; the foreign key has no cascade).
     */
    void deleteBySectionAvailabilityWindowIdIn(Collection<UUID> sectionAvailabilityWindowIds);

    /** Batch lookup for the player availability grid (docs/specs/068-player-availability-grid.md). */
    List<MatchSquadMember> findByMatchIdIn(Collection<UUID> matchIds);
}
