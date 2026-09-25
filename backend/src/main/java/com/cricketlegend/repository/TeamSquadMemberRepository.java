package com.cricketlegend.repository;

import com.cricketlegend.domain.TeamSquadMember;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
