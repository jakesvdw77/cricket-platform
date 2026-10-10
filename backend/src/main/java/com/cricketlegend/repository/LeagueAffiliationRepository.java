package com.cricketlegend.repository;

import com.cricketlegend.domain.LeagueAffiliation;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * See docs/specs/029-league-management.md. {@link #existsByLeagueIdAndTeamIdAndSeasonId} backs
 * the triple-uniqueness 409 check ahead of the DB unique constraint.
 */
public interface LeagueAffiliationRepository extends JpaRepository<LeagueAffiliation, UUID> {

    List<LeagueAffiliation> findByLeagueId(UUID leagueId);

    boolean existsByLeagueIdAndTeamIdAndSeasonId(UUID leagueId, UUID teamId, UUID seasonId);

    /**
     * Per docs/specs/050-league-schedule-and-fixtures.md: the distinct-team count per league for a
     * single {@code seasonId}, in one round trip for a club's whole league collection —
     * backs {@code LeagueDto.currentSeasonTeamCount} in {@code LeagueServiceImpl.list()} (never a
     * per-league query). Spring Data interface projection ({@link LeagueTeamCount}), the first one
     * in this codebase — kept in this file, close to the query it backs.
     */
    @Query("select a.leagueId as leagueId, count(distinct a.teamId) as teamCount "
            + "from LeagueAffiliation a where a.seasonId = :seasonId group by a.leagueId")
    List<LeagueTeamCount> countDistinctTeamsBySeasonId(@Param("seasonId") UUID seasonId);

    /**
     * Per docs/specs/071-league-card-redesign.md: every affiliated team of every league for one
     * {@code seasonId}, name-sorted, in one round trip (grouped by {@code leagueId} in the
     * service). A team affiliated to two leagues appears once per league.
     */
    @Query("select a.leagueId as leagueId, t.name as name, t.abbreviation as abbreviation, "
            + "t.logoUrl as logoUrl from LeagueAffiliation a, Team t "
            + "where a.teamId = t.id and a.seasonId = :seasonId order by lower(t.name), t.name")
    List<LeagueTeamSummary> findTeamSummariesBySeasonId(@Param("seasonId") UUID seasonId);

    /** Projection backing {@link #findTeamSummariesBySeasonId}. */
    interface LeagueTeamSummary {
        UUID getLeagueId();

        String getName();

        String getAbbreviation();

        String getLogoUrl();
    }

    /**
     * Per docs/specs/094-club-structure-and-seasons.md: the distinct leagues in which a team of each of the club's
     * sections is affiliated in {@code seasonId}, in one round trip for the whole club (never per section), unordered (the service sorts by name). The club
     * scope is the team's {@code clubId}; a league the club's team joined but another club owns is included by name.
     */
    @Query("select distinct t.sectionId as sectionId, l.id as leagueId, l.name as leagueName "
            + "from LeagueAffiliation a, Team t, League l "
            + "where a.teamId = t.id and a.leagueId = l.id and t.clubId = :clubId and a.seasonId = :seasonId")
    List<SectionLeagueRef> findSectionLeagueRefs(@Param("clubId") UUID clubId, @Param("seasonId") UUID seasonId);

    /** Projection backing {@link #findSectionLeagueRefs}. */
    interface SectionLeagueRef {
        UUID getSectionId();

        UUID getLeagueId();

        String getLeagueName();
    }

    /** Projection backing {@link #countDistinctTeamsBySeasonId}. */
    interface LeagueTeamCount {
        UUID getLeagueId();

        long getTeamCount();
    }
}
