package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.repository.PlayerStatsFactsRepository.FilterOptionView;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * docs/specs/116-team-stats.md: the small non-counter reads of team statistics: the table's filter options and the one-team
 * page's match facts (its last five results and the match each encoded key of the aggregate points to). The values on the
 * page come from the aggregate; these only say which match. Same counted team results and the same eight parameters as
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
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly);

    /**
     * The last five counted results of the one team in {@code teamId} (call it with a team id), newest first, forfeits
     * included. See {@link TeamStatsSql#TEAM_FORM}.
     */
    @Query(value = TeamStatsSql.TEAM_FORM, nativeQuery = true)
    List<TeamFormView> form(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly);

    /**
     * The match each encoded key of {@link TeamStatsAggregateRepository#aggregate} points to, for the one team in {@code
     * teamId}. Keys are passed as the aggregate returned them (null when it had none). See {@link
     * TeamStatsSql#MATCH_REFERENCES}.
     */
    @Query(value = TeamStatsSql.MATCH_REFERENCES, nativeQuery = true)
    List<MatchReferenceView> matchReferences(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("highKey") BigDecimal highKey,
            @Param("lowKey") BigDecimal lowKey,
            @Param("chaseKey") BigDecimal chaseKey,
            @Param("victoryRunsKey") BigDecimal victoryRunsKey,
            @Param("victoryWicketsKey") BigDecimal victoryWicketsKey);

    /**
     * docs/specs/117: the newest {@code limit} counted team results of the one team in {@code teamId}, forfeits included,
     * with the counters of the team Dashboard's series. See {@link TeamStatsSql#DASHBOARD_RESULTS}.
     */
    @Query(value = TeamStatsSql.DASHBOARD_RESULTS, nativeQuery = true)
    List<TeamDashboardResultView> dashboardResults(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("limit") int limit);

    /**
     * docs/specs/147: the newest {@code limit} counted team results of the one team in {@code teamId}, forfeits included,
     * with the stored facts of the Hub's batting-first, toss, head-to-head and close-game figures. See {@link
     * TeamStatsSql#HELD_RESULT_FACTS}.
     */
    @Query(value = TeamStatsSql.HELD_RESULT_FACTS, nativeQuery = true)
    List<HeldResultFactView> heldResultFacts(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("limit") int limit);

    /** docs/specs/147: runs and wickets per player over the one team's counted results. See {@link TeamStatsSql#HELD_CONTRIBUTION}. */
    @Query(value = TeamStatsSql.HELD_CONTRIBUTION, nativeQuery = true)
    List<HeldContributionView> heldContribution(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly);

    /** docs/specs/147: the extras-received, card-coverage and squad counters of the one team (one row). See {@link TeamStatsSql#HELD_EXTENT}. */
    @Query(value = TeamStatsSql.HELD_EXTENT, nativeQuery = true)
    HeldExtentView heldExtent(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly);

    /** docs/specs/147 amendment 3: the batting entries of the team's own usable innings. See {@link TeamStatsSql#HELD_BATTING_ROWS}. */
    @Query(value = TeamStatsSql.HELD_BATTING_ROWS, nativeQuery = true)
    List<HeldBattingRowView> heldBattingRows(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly);

    /** docs/specs/147 amendment 3: the bowling rows and batter dismissals of the opposition's usable innings. See {@link TeamStatsSql#HELD_WICKET_ROWS}. */
    @Query(value = TeamStatsSql.HELD_WICKET_ROWS, nativeQuery = true)
    List<HeldWicketRowView> heldWicketRows(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly);

    /** docs/specs/147 amendment 3: the playing area and innings sums of each counted non-forfeit result. See {@link TeamStatsSql#HELD_VENUE_ROWS}. */
    @Query(value = TeamStatsSql.HELD_VENUE_ROWS, nativeQuery = true)
    List<HeldVenueRowView> heldVenueRows(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly);

    /** docs/specs/147 amendment 3: the team's fielding credits per result and fielder. See {@link TeamStatsSql#HELD_FIELDING_ROWS}. */
    @Query(value = TeamStatsSql.HELD_FIELDING_ROWS, nativeQuery = true)
    List<HeldFieldingRowView> heldFieldingRows(
            @Param("clubId") UUID clubId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly);

    /** One counted result of {@link TeamStatsSql#HELD_RESULT_FACTS}; the getter names are its quoted aliases. */
    interface HeldResultFactView {
        UUID getMatchId();

        Long getMatchEpochMillis();

        String getOpponentName();

        String getOutcome();

        String getWinningSide();

        String getSide();

        String getDecidedBy();

        String getMarginType();

        Integer getMarginValue();

        String getTossWonBy();

        String getFirstBattingSide();
    }

    /** {@code kind}: RUNS or WICKETS; {@code profileId} and {@code playerName} are null for the guest group. */
    interface HeldContributionView {
        String getKind();

        UUID getProfileId();

        String getPlayerName();

        Long getValue();
    }

    /** The counters of {@link TeamStatsSql#HELD_EXTENT}; the getter names are its quoted aliases. */
    interface HeldExtentView {
        Long getOwnUsable();

        Long getOwnWithCard();

        Long getOppUsable();

        Long getOppWithCard();

        Long getOwnExtrasInnings();

        Long getOwnExtras();

        Long getOwnWidesInnings();

        Long getOwnWides();

        Long getOwnNoBallsInnings();

        Long getOwnNoBalls();

        Long getOwnByesInnings();

        Long getOwnByes();

        Long getOwnLegByesInnings();

        Long getOwnLegByes();

        Long getOwnPenaltyInnings();

        Long getOwnPenaltyRuns();

        Long getOwnUsableExtrasInnings();

        Long getOwnUsableExtras();

        Long getOwnUsableExtrasRuns();

        Long getOppUsableExtrasInnings();

        Long getOppUsableExtras();

        Long getOppUsableExtrasRuns();

        Long getPlayersUsed();

        Long getGuestRows();
    }

    /** One recent counted result; the getter names are the quoted aliases of {@link TeamStatsSql#TEAM_FORM}. */
    interface TeamFormView {
        UUID getResultId();

        UUID getMatchId();

        Long getMatchEpochMillis();

        String getOpponentName();

        Boolean getDerby();

        String getOutcome();

        String getWinningSide();

        String getSide();
    }

    /** {@code kind}: HIGH, LOW, CHASE, VICTORY_RUNS or VICTORY_WICKETS. */
    interface MatchReferenceView {
        String getKind();

        UUID getMatchId();

        String getOpponentName();
    }

    /** One counted team result of {@link TeamStatsSql#DASHBOARD_RESULTS}; the getter names are its quoted aliases. */
    interface TeamDashboardResultView {
        UUID getResultId();

        UUID getMatchId();

        Long getMatchEpochMillis();

        String getOpponentName();

        Boolean getDerby();

        String getOutcome();

        String getWinningSide();

        String getSide();

        Long getOwnInnings();

        Long getOppInnings();

        Long getOwnUsable();

        Long getOppUsable();

        Long getOwnRuns();

        Long getOwnWickets();

        Long getOwnBalls();

        Long getOwnRunsWithBalls();

        BigDecimal getOwnOvers();

        Long getOppRuns();

        Long getOppWickets();

        Long getOppBalls();

        Long getOppRunsWithBalls();

        BigDecimal getOppOvers();

        Long getExtras();

        Long getWides();

        Long getNoBalls();

        Long getByes();

        Long getLegByes();

        Long getPenaltyRuns();

        Long getBowlBalls();

        Long getBowlDots();

        Long getBowlRows();

        Long getBowlDotsRows();

        Boolean getNrrUsable();

        Long getNrrOwnRuns();

        Long getNrrOppRuns();

        BigDecimal getNrrOwnOvers();

        BigDecimal getNrrOppOvers();
    }

    /** One row of {@link TeamStatsSql#HELD_BATTING_ROWS}; the getter names are its quoted aliases. */
    interface HeldBattingRowView {
        UUID getMatchId();

        Integer getSequence();

        Integer getInningsRuns();

        Boolean getHasEntry();

        Integer getPosition();

        Integer getRuns();

        Integer getBalls();

        Integer getFours();

        Integer getSixes();

        String getHowOut();
    }

    /** One row of {@link TeamStatsSql#HELD_WICKET_ROWS}. */
    interface HeldWicketRowView {
        UUID getMatchId();

        Integer getSequence();

        UUID getBowlingEntryId();

        Integer getWickets();

        String getHowOut();

        Long getCredited();
    }

    /** One row of {@link TeamStatsSql#HELD_VENUE_ROWS}. */
    interface HeldVenueRowView {
        UUID getMatchId();

        UUID getAreaId();

        String getAreaName();

        Boolean getClubField();

        Long getOwnRuns();

        Long getOwnWickets();

        Long getOppRuns();

        Long getOppWickets();
    }

    /** One row of {@link TeamStatsSql#HELD_FIELDING_ROWS}. */
    interface HeldFieldingRowView {
        UUID getMatchId();

        UUID getProfileId();

        String getPlayerName();

        Long getEntries();

        Long getCatches();

        Long getStumpings();

        Long getRunOuts();
    }
}
