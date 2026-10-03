package com.cricketlegend.repository;

import com.cricketlegend.domain.LeagueTeam;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * See docs/specs/070-league-teams.md. {@link #existsByLeagueIdAndSeasonIdAndNameIgnoreCase}/
 * {@link #existsByLeagueIdAndSeasonIdAndNameIgnoreCaseAndIdNot} back the duplicate-name 409 ahead
 * of the {@code ux_league_team_name} unique index (same style as {@code
 * ProductRepository.existsByCodeIgnoreCase}).
 */
public interface LeagueTeamRepository extends JpaRepository<LeagueTeam, UUID> {

    boolean existsByLeagueIdAndSeasonIdAndNameIgnoreCase(UUID leagueId, UUID seasonId, String name);

    boolean existsByLeagueIdAndSeasonIdAndNameIgnoreCaseAndIdNot(
            UUID leagueId, UUID seasonId, String name, UUID id);

    /** A league season's league teams (active and inactive), sorted by name case-insensitively. */
    @Query("select t from LeagueTeam t where t.leagueId = :leagueId and t.seasonId = :seasonId "
            + "order by lower(t.name), t.name")
    List<LeagueTeam> findByLeagueAndSeason(@Param("leagueId") UUID leagueId, @Param("seasonId") UUID seasonId);

    /** Same as {@link #findByLeagueAndSeason} restricted to active rows (the match picker). */
    @Query("select t from LeagueTeam t where t.leagueId = :leagueId and t.seasonId = :seasonId "
            + "and t.active = true order by lower(t.name), t.name")
    List<LeagueTeam> findActiveByLeagueAndSeason(
            @Param("leagueId") UUID leagueId, @Param("seasonId") UUID seasonId);

    /**
     * Number of matches referencing each of {@code leagueTeamIds} (as home or away), in one round
     * trip for a whole list (never per row). Ids with no referencing match are absent from the
     * result. Backs {@code LeagueTeamDto.referencedByMatchCount}.
     */
    @Query("select t.id as leagueTeamId, count(m) as matchCount from LeagueTeam t, Match m "
            + "where t.id in :leagueTeamIds "
            + "and (m.homeLeagueTeamId = t.id or m.awayLeagueTeamId = t.id) group by t.id")
    List<ReferencedMatchCount> countReferencingMatches(@Param("leagueTeamIds") Collection<UUID> leagueTeamIds);

    /** True when any match uses {@code leagueTeamId} on either side. Decides delete versus deactivate. */
    @Query("select case when count(m) > 0 then true else false end from Match m "
            + "where m.homeLeagueTeamId = :leagueTeamId or m.awayLeagueTeamId = :leagueTeamId")
    boolean existsReference(@Param("leagueTeamId") UUID leagueTeamId);

    /** Projection backing {@link #countReferencingMatches}. */
    interface ReferencedMatchCount {
        UUID getLeagueTeamId();

        long getMatchCount();
    }
}
