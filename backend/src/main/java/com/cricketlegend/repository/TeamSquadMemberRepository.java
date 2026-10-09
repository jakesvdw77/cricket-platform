package com.cricketlegend.repository;

import java.util.Collection;
import com.cricketlegend.domain.TeamSquadMember;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Season-scoped squad membership, per this spec's own pre-build amendment (see
 * docs/specs/029-league-management.md's Rollout Notes) — every query here is scoped by {@code
 * (teamId, seasonId)}, never just {@code teamId} alone, so a squad is always "this team's squad
 * for this season."
 */
public interface TeamSquadMemberRepository extends JpaRepository<TeamSquadMember, UUID> {

    List<TeamSquadMember> findByTeamIdAndSeasonId(UUID teamId, UUID seasonId);

    Optional<TeamSquadMember> findByTeamIdAndSeasonIdAndPlayerProfileId(
            UUID teamId, UUID seasonId, UUID playerProfileId);

    boolean existsByTeamIdAndSeasonIdAndPlayerProfileId(
            UUID teamId, UUID seasonId, UUID playerProfileId);

    void deleteByTeamIdAndSeasonIdAndPlayerProfileId(UUID teamId, UUID seasonId, UUID playerProfileId);

    boolean existsByTeamIdAndSeasonIdAndJerseyNumberAndIdNot(
            UUID teamId, UUID seasonId, Integer jerseyNumber, UUID excludeId);

    /**
     * The current captain (at most one, per {@code ux_team_squad_captain}) for {@code teamId}'s
     * squad in {@code seasonId} — used by {@code TeamSquadServiceImpl.unsetOtherCaptains}
     * (docs/specs/057-team-extended-profile.md) to find who to un-mark when a new captain is set.
     */
    List<TeamSquadMember> findByTeamIdAndSeasonIdAndIsCaptainTrue(UUID teamId, UUID seasonId);

    /**
     * Batch lookup for the player availability grid (docs/specs/068-player-availability-grid.md):
     * the cross product of {@code teamIds} x {@code seasonIds}; callers keep only the exact
     * (team, season) pairs they need, in memory.
     */
    List<TeamSquadMember> findByTeamIdInAndSeasonIdIn(Collection<UUID> teamIds, Collection<UUID> seasonIds);

    /**
     * Players who are in at least one team squad for {@code seasonId} (docs/specs/088-players-polls-alignment.md): the
     * Players page "In a squad this season" counter and quick filter. One statement; the season belongs to one club.
     */
    @Query("select distinct m.playerProfileId from TeamSquadMember m where m.seasonId = :seasonId")
    List<UUID> findDistinctPlayerProfileIdsBySeasonId(@Param("seasonId") UUID seasonId);
}
