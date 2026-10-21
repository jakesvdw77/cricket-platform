package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.repository.PlayerStatsFactsRepository.FilterOptionView;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * docs/specs/116-team-stats.md: the small non-counter reads of team statistics. The table needs only the filter options
 * (the one-team page adds its match facts in a later slice). Same counted team results and the same seven parameters as
 * {@link TeamStatsAggregateRepository} (see {@link TeamStatsSql}). Touched only by the statistics services (ArchUnit).
 */
public interface TeamStatsFactsRepository extends Repository<MatchResult, UUID> {

    /**
     * The distinct season, league, section and competition type across the counted team results. Pass null for the four
     * optional filters: the options are never narrowed by them. Reuses the player filter-option row shape; {@code teamId}
     * is always null here because the table lists the teams.
     */
    @Query(value = TeamStatsSql.FILTER_OPTIONS, nativeQuery = true)
    List<FilterOptionView> filterOptions(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds);
}
