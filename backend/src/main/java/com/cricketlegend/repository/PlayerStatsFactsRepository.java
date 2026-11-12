package com.cricketlegend.repository;

import com.cricketlegend.domain.MatchResult;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * docs/specs/103-player-stats.md, "Shape of the read" point 4: the few small per-player queries that are not additive
 * counters (recent form, innings by batting position, dismissal modes). Same counted appearances and the same eight
 * parameters as {@link PlayerStatsAggregateRepository} (see {@link PlayerStatsSql}); the per-player queries are for one
 * {@code playerId}, the leaderboard queries (results counted, roster, best innings and spells, filter options) take the club.
 * Touched only by the statistics services (ArchUnit). Dates are epoch milliseconds so the JDBC temporal mapping never
 * matters.
 */
public interface PlayerStatsFactsRepository extends Repository<MatchResult, UUID> {

    /** The five most recent batting innings, newest first. */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select ap.match_id as "matchId",
                   cast(extract(epoch from ap.match_date) * 1000 as bigint) as "matchEpochMillis",
                   be.runs as "runs",
                   (be.how_out in ('NOT_OUT', 'RETIRED_NOT_OUT')) as "notOut",
                   case when\s""" + PlayerStatsSql.VALID_BALLS + """

                        then be.balls end as "balls"
            from ap
            join batting_entry be on be.result_player_id = ap.rpid
            join match_innings i on i.id = be.match_innings_id and i.kind = 'REGULAR'
            where\s""" + PlayerStatsSql.COUNTED_BATTING_ROW + """

            order by ap.match_date desc, i.sequence desc, be.id desc
            limit 5
            """, nativeQuery = true)
    List<InningsView> recentInnings(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<InningsView> recentInnings(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds) {
        return recentInnings(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, false, null);
    }

    /** The five most recent bowling spells (a bowler who bowled a ball or conceded a run), newest first. */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select ap.match_id as "matchId",
                   cast(extract(epoch from ap.match_date) * 1000 as bigint) as "matchEpochMillis",
                   bw.wickets as "wickets",
                   bw.runs as "runs",
                   bw.balls as "balls",
                   ap.bpo as "ballsPerOver"
            from ap
            join bowling_entry bw on bw.result_player_id = ap.rpid
            join match_innings i on i.id = bw.match_innings_id and i.kind = 'REGULAR'
            where\s""" + PlayerStatsSql.COUNTED_SPELL + """

            order by ap.match_date desc, i.sequence desc, bw.id desc
            limit 5
            """, nativeQuery = true)
    List<SpellView> recentSpells(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<SpellView> recentSpells(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds) {
        return recentSpells(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, false, null);
    }

    /** Innings, runs and dismissals per actual batting position (rows without a position are left out). */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select be.position as "position",
                   count(*) as "innings",
                   coalesce(sum(be.runs), 0) as "runs",
                   count(*) filter (where be.how_out not in ('NOT_OUT', 'RETIRED_NOT_OUT')) as "dismissals"
            from ap
            join batting_entry be on be.result_player_id = ap.rpid
            join match_innings i on i.id = be.match_innings_id and i.kind = 'REGULAR'
            where\s""" + PlayerStatsSql.COUNTED_BATTING_ROW + """

              and be.position is not null
            group by be.position
            order by be.position
            """, nativeQuery = true)
    List<PositionView> positions(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<PositionView> positions(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds) {
        return positions(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, false, null);
    }

    /** How the player's own innings ended, as stored ({@code how_out}), with a count each. */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select be.how_out as "type", count(*) as "total"
            from ap
            join batting_entry be on be.result_player_id = ap.rpid
            join match_innings i on i.id = be.match_innings_id and i.kind = 'REGULAR'
            where\s""" + PlayerStatsSql.COUNTED_BATTING_ROW + """

            group by be.how_out
            """, nativeQuery = true)
    List<DismissalCountView> batterDismissals(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<DismissalCountView> batterDismissals(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds) {
        return batterDismissals(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, false, null);
    }

    /** The dismissals that name this player as the bowler ({@code bowler_result_player_id}), by how the batter was out. */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select be.how_out as "type", count(*) as "total"
            from ap
            join batting_entry be on be.bowler_result_player_id = ap.rpid
            join match_innings i on i.id = be.match_innings_id and i.kind = 'REGULAR'
            where be.how_out is not null
            group by be.how_out
            """, nativeQuery = true)
    List<DismissalCountView> bowlerDismissals(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<DismissalCountView> bowlerDismissals(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds) {
        return bowlerDismissals(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, false, null);
    }

    /**
     * The distinct season, league, own-side team (of this club), its section and competition type across the player's
     * counted appearances. Pass null for the four optional filters: the options are never narrowed by them.
     */
    @Query(value = PlayerStatsSql.APPEARANCES_WITH_REACH + """
            select distinct m.season_id as "seasonId",
                   m.league_id as "leagueId",
                   t.id as "teamId",
                   t.section_id as "sectionId",
                   case when m.league_id is not null then 'LEAGUE' else 'FRIENDLY' end as "competition"
            from ap
            join match m on m.id = ap.match_id
            join team t on t.id = case when ap.side = 'HOME' then m.home_team_id else m.away_team_id end
                       and t.club_id = :clubId
            """, nativeQuery = true)
    List<FilterOptionView> filterOptions(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId,
            @Param("leagueReachRestricted") boolean leagueReachRestricted,
            @Param("leagueReachIds") Collection<UUID> leagueReachIds);

    /** The Player Hub scope without a league reach (docs/specs/145): the reach is unrestricted. */
    default List<FilterOptionView> filterOptions(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds,
            boolean playerVisibleOnly,
            UUID matchId) {
        return filterOptions(
                clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, playerVisibleOnly, matchId, false, PlayerStatsSql.NO_REACH);
    }

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<FilterOptionView> filterOptions(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds) {
        return filterOptions(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, false, null);
    }

    /**
     * The number of distinct published results with at least one counted appearance in the scope: the "based on N
     * results" line of the leaderboards. Pass null {@code playerId} for the whole club.
     */
    @Query(value = PlayerStatsSql.APPEARANCES_WITH_REACH + """
            select count(distinct ap.mrid) from ap
            """, nativeQuery = true)
    long countResults(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId,
            @Param("leagueReachRestricted") boolean leagueReachRestricted,
            @Param("leagueReachIds") Collection<UUID> leagueReachIds);

    /** The Player Hub scope without a league reach (docs/specs/145): the reach is unrestricted. */
    default long countResults(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds,
            boolean playerVisibleOnly,
            UUID matchId) {
        return countResults(
                clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, playerVisibleOnly, matchId, false, PlayerStatsSql.NO_REACH);
    }

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default long countResults(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds) {
        return countResults(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, false, null);
    }

    /**
     * Docs/specs/088: the distinct (player, match) pairs of the club's counted appearances (the same {@link
     * PlayerStatsSql#APPEARANCES} rules as the statistics page) for the Players list's games columns. A deactivated
     * match with a published result counts, exactly as on the statistics page (docs/specs/103 decision 21); only the
     * selection fallback requires an active match. Pass a null {@code seasonId} for all seasons. One statement for every player.
     */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select distinct ap.pid as "playerProfileId", ap.match_id as "matchId"
            from ap
            """, nativeQuery = true)
    List<PlayerMatchView> countedPlayerMatches(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<PlayerMatchView> countedPlayerMatches(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds) {
        return countedPlayerMatches(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, false, null);
    }

    /**
     * Docs/specs/088: the matches of the club that have a published result, whatever its outcome (the result is then
     * the truth about who played, so a selection for such a match is ignored). Null {@code seasonId} for all seasons.
     */
    @Query(value = """
            select distinct r.match_id
            from match_result r
            join match pm on pm.id = r.match_id
            where r.club_id = :clubId
              and\s""" + StatsCountingSql.PUBLISHED + """

              and (cast(:seasonId as uuid) is null or pm.season_id = cast(:seasonId as uuid))
            """, nativeQuery = true)
    List<UUID> publishedResultMatchIds(@Param("clubId") UUID clubId, @Param("seasonId") UUID seasonId);

    /**
     * Every player profile of the club with the name and status the leaderboards show (one bounded roster read; the
     * aggregate rows are matched to it by id).
     */
    @Query(value = """
            select pp.id as "playerId", p.first_name as "firstName", p.last_name as "lastName", pp.active as "active"
            from player_profile pp
            join person p on p.id = pp.person_id
            where pp.club_id = :clubId
            """, nativeQuery = true)
    List<PlayerNameView> clubPlayers(@Param("clubId") UUID clubId);

    /**
     * For each listed player, their highest-scoring innings in the scope (same counted appearances and key as the
     * aggregate's highest score: more runs, a not-out innings first, then the most recent match), with the match, the
     * opponent and the balls faced when recorded. One row per player; {@code playerIds} must not be empty.
     */
    @Query(value = PlayerStatsSql.APPEARANCES_WITH_REACH + """
            select distinct on (ap.pid)
                   ap.pid as "playerId",
                   ap.match_id as "matchId",
                   cast(extract(epoch from ap.match_date) * 1000 as bigint) as "matchEpochMillis",
                   case when ap.side = 'HOME' then coalesce(oat.name, om.away_team_name)
                        else coalesce(hot.name, om.home_team_name) end as "opponent",
                   case when\s""" + PlayerStatsSql.VALID_BALLS + """

                        then be.balls end as "balls"
            from ap
            join match om on om.id = ap.match_id
            left join team hot on hot.id = om.home_team_id
            left join team oat on oat.id = om.away_team_id
            join batting_entry be on be.result_player_id = ap.rpid
            join match_innings i on i.id = be.match_innings_id and i.kind = 'REGULAR'
            where\s""" + PlayerStatsSql.COUNTED_BATTING_ROW + """

              and ap.pid in (:playerIds)
            order by ap.pid,
                     (cast(be.runs as bigint) * 2 + case when be.how_out in ('NOT_OUT', 'RETIRED_NOT_OUT') then 1 else 0 end)
                         desc nulls last,
                     ap.match_date desc, i.sequence desc
            """, nativeQuery = true)
    List<BestInningsView> bestInnings(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerIds") Collection<UUID> playerIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId,
            @Param("leagueReachRestricted") boolean leagueReachRestricted,
            @Param("leagueReachIds") Collection<UUID> leagueReachIds);

    /** The Player Hub scope without a league reach (docs/specs/145): the reach is unrestricted. */
    default List<BestInningsView> bestInnings(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds,
            Collection<UUID> playerIds,
            boolean playerVisibleOnly,
            UUID matchId) {
        return bestInnings(
                clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, playerIds, playerVisibleOnly, matchId, false, PlayerStatsSql.NO_REACH);
    }

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<BestInningsView> bestInnings(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds,
            Collection<UUID> playerIds) {
        return bestInnings(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, playerIds, false, null);
    }

    /**
     * For each listed player, their best bowling innings in the scope (same key as the aggregate's best bowling: most
     * wickets, fewest runs, most balls, then the most recent match), with the match and the opponent; {@code balls} is
     * the balls bowled. One row per player; {@code playerIds} must not be empty.
     */
    @Query(value = PlayerStatsSql.APPEARANCES_WITH_REACH + """
            select distinct on (ap.pid)
                   ap.pid as "playerId",
                   ap.match_id as "matchId",
                   cast(extract(epoch from ap.match_date) * 1000 as bigint) as "matchEpochMillis",
                   case when ap.side = 'HOME' then coalesce(oat.name, om.away_team_name)
                        else coalesce(hot.name, om.home_team_name) end as "opponent",
                   bw.balls as "balls"
            from ap
            join match om on om.id = ap.match_id
            left join team hot on hot.id = om.home_team_id
            left join team oat on oat.id = om.away_team_id
            join bowling_entry bw on bw.result_player_id = ap.rpid
            join match_innings i on i.id = bw.match_innings_id and i.kind = 'REGULAR'
            where (\s""" + PlayerStatsSql.COUNTED_SPELL + """
)
              and ap.pid in (:playerIds)
            order by ap.pid,
                     (cast(bw.wickets as bigint) * 10000000000
                      + cast(99999 - least(bw.runs, 99999) as bigint) * 100000
                      + least(bw.balls, 99999)) desc,
                     ap.match_date desc, i.sequence desc
            """, nativeQuery = true)
    List<BestInningsView> bestSpells(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerIds") Collection<UUID> playerIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId,
            @Param("leagueReachRestricted") boolean leagueReachRestricted,
            @Param("leagueReachIds") Collection<UUID> leagueReachIds);

    /** The Player Hub scope without a league reach (docs/specs/145): the reach is unrestricted. */
    default List<BestInningsView> bestSpells(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds,
            Collection<UUID> playerIds,
            boolean playerVisibleOnly,
            UUID matchId) {
        return bestSpells(
                clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, playerIds, playerVisibleOnly, matchId, false, PlayerStatsSql.NO_REACH);
    }

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<BestInningsView> bestSpells(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds,
            Collection<UUID> playerIds) {
        return bestSpells(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, playerIds, false, null);
    }

    /**
     * How many counted matches each player played for each of the club's teams in the scope (the row's side picks the
     * team), so the standings can show the most frequent one as the player's team. Pass null {@code playerId} for the whole
     * club.
     */
    @Query(value = PlayerStatsSql.APPEARANCES_WITH_REACH + """
            select ap.pid as "playerId", t.name as "teamName", count(distinct ap.mrid) as "total"
            from ap
            join match m on m.id = ap.match_id
            join team t on t.id = case when ap.side = 'HOME' then m.home_team_id else m.away_team_id end
                       and t.club_id = :clubId
            group by ap.pid, t.id, t.name
            """, nativeQuery = true)
    List<PlayerTeamView> playerTeams(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId,
            @Param("leagueReachRestricted") boolean leagueReachRestricted,
            @Param("leagueReachIds") Collection<UUID> leagueReachIds);

    /** The Player Hub scope without a league reach (docs/specs/145): the reach is unrestricted. */
    default List<PlayerTeamView> playerTeams(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds,
            boolean playerVisibleOnly,
            UUID matchId) {
        return playerTeams(
                clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, playerVisibleOnly, matchId, false, PlayerStatsSql.NO_REACH);
    }

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<PlayerTeamView> playerTeams(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds) {
        return playerTeams(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, false, null);
    }

    /**
     * docs/specs/115-player-match-list.md: the number of distinct counted matches of the player under the filters (the
     * match list's {@code totalElements}). Same appearances as {@link #countResults}, named for the list.
     */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select count(distinct ap.mrid) from ap
            """, nativeQuery = true)
    long matchCount(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default long matchCount(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds) {
        return matchCount(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, false, null);
    }

    /**
     * docs/specs/115: one page of the player's counted matches, one row per match (a derby player on both sides is one
     * row, with both side flags set). Newest first, {@code match.id} descending as the tie-break; {@code ascending}
     * reverses both. The opponent is the opposite side's team name, else its free-text name; the player's own side(s) are
     * given by {@code onHome}/{@code onAway} with the home and away names and team ids (the builder picks).
     */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select ap.mrid as "resultId",
                   ap.match_id as "matchId",
                   cast(extract(epoch from ap.match_date) * 1000 as bigint) as "matchEpochMillis",
                   ap.bpo as "ballsPerOver",
                   ap.outcome as "outcome",
                   ap.winning_side as "winningSide",
                   ap.derby as "derby",
                   bool_or(ap.side = 'HOME') as "onHome",
                   bool_or(ap.side = 'AWAY') as "onAway",
                   m.league_id as "leagueId",
                   lg.name as "leagueName",
                   m.home_team_id as "homeTeamId",
                   coalesce(ht.name, m.home_team_name) as "homeTeamName",
                   m.away_team_id as "awayTeamId",
                   coalesce(awt.name, m.away_team_name) as "awayTeamName",
                   case when bool_or(ap.side = 'HOME') then coalesce(awt.name, m.away_team_name)
                        else coalesce(ht.name, m.home_team_name) end as "opponentName",
                   bool_or(\s""" + PlayerStatsSql.HAS_BATTING_CARD + """
) as "hasBattingCard",
                   bool_or(\s""" + PlayerStatsSql.HAS_BOWLING_CARD + """
) as "hasBowlingCard"
            from ap
            join match m on m.id = ap.match_id
            left join team ht on ht.id = m.home_team_id
            left join team awt on awt.id = m.away_team_id
            left join league lg on lg.id = m.league_id
            group by ap.mrid, ap.match_id, ap.match_date, ap.bpo, ap.outcome, ap.winning_side, ap.derby,
                     m.league_id, lg.name, m.home_team_id, ht.name, m.home_team_name,
                     m.away_team_id, awt.name, m.away_team_name
            order by case when cast(:ascending as boolean) then ap.match_date end asc,
                     case when cast(:ascending as boolean) then ap.match_id end asc,
                     case when not cast(:ascending as boolean) then ap.match_date end desc,
                     case when not cast(:ascending as boolean) then ap.match_id end desc
            limit :limit offset :offset
            """, nativeQuery = true)
    List<MatchHeaderView> matchPage(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("ascending") boolean ascending,
            @Param("limit") int limit,
            @Param("offset") long offset,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<MatchHeaderView> matchPage(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds,
            boolean ascending,
            int limit,
            long offset) {
        return matchPage(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, ascending, limit, offset, false, null);
    }

    /**
     * docs/specs/115: the player's counted batting rows (a batting row with {@code how_out} set and not {@code
     * DID_NOT_BAT}) for the listed matches, reached only through the counted appearance on {@code REGULAR} innings. {@code
     * balls} is null when not recorded or a 0-ball innings that scored runs. Ordered by innings sequence.
     */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select ap.mrid as "resultId",
                   be.runs as "runs",
                   case when\s""" + PlayerStatsSql.VALID_BALLS + """

                        then be.balls end as "balls",
                   be.fours as "fours",
                   be.sixes as "sixes",
                   be.how_out as "howOut"
            from ap
            join batting_entry be on be.result_player_id = ap.rpid
            join match_innings i on i.id = be.match_innings_id and i.kind = 'REGULAR'
            where\s""" + PlayerStatsSql.COUNTED_BATTING_ROW + """

              and ap.mrid in (:resultIds)
            order by ap.mrid, i.sequence, be.id
            """, nativeQuery = true)
    List<MatchBattingView> matchBatting(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("resultIds") Collection<UUID> resultIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<MatchBattingView> matchBatting(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds,
            Collection<UUID> resultIds) {
        return matchBatting(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, resultIds, false, null);
    }

    /** docs/specs/115: the player's bowling rows (every stored row; the builder decides which are spells) for the listed matches. */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select ap.mrid as "resultId",
                   bw.balls as "balls",
                   bw.maidens as "maidens",
                   bw.runs as "runs",
                   bw.wickets as "wickets",
                   bw.dots as "dots",
                   bw.wides as "wides",
                   bw.no_balls as "noBalls"
            from ap
            join bowling_entry bw on bw.result_player_id = ap.rpid
            join match_innings i on i.id = bw.match_innings_id and i.kind = 'REGULAR'
            where ap.mrid in (:resultIds)
            order by ap.mrid, i.sequence, bw.id
            """, nativeQuery = true)
    List<MatchBowlingView> matchBowling(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("resultIds") Collection<UUID> resultIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<MatchBowlingView> matchBowling(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds,
            Collection<UUID> resultIds) {
        return matchBowling(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, resultIds, false, null);
    }

    /** docs/specs/115: the player's stored fielding credits, summed per match, for the listed matches. */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select ap.mrid as "resultId",
                   coalesce(sum(fe.catches), 0) as "catches",
                   coalesce(sum(fe.stumpings), 0) as "stumpings",
                   coalesce(sum(fe.run_outs), 0) as "runOuts"
            from ap
            join fielding_entry fe on fe.result_player_id = ap.rpid
            join match_innings i on i.id = fe.match_innings_id and i.kind = 'REGULAR'
            where ap.mrid in (:resultIds)
            group by ap.mrid
            """, nativeQuery = true)
    List<MatchFieldingView> matchFielding(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("resultIds") Collection<UUID> resultIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<MatchFieldingView> matchFielding(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds,
            Collection<UUID> resultIds) {
        return matchFielding(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, resultIds, false, null);
    }

    /** docs/specs/115: the awards won by the player's counted appearances, counted per match, for the listed matches. */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select ap.mrid as "resultId",
                   count(*) filter (where ma.award_type = 'PLAYER_OF_MATCH') as "playerOfMatch",
                   count(*) filter (where ma.award_type = 'TEAM_PLAYER_OF_MATCH') as "teamPlayerOfMatch"
            from ap
            join match_award ma on ma.result_player_id = ap.rpid
            where ap.mrid in (:resultIds)
            group by ap.mrid
            """, nativeQuery = true)
    List<MatchAwardView> matchAwards(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("resultIds") Collection<UUID> resultIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<MatchAwardView> matchAwards(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds,
            Collection<UUID> resultIds) {
        return matchAwards(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, resultIds, false, null);
    }

    /**
     * docs/specs/117: for the listed matches, every stored bowling row of the player left-joined to the batting entries of
     * the same innings that name the player as the bowler, one row per (bowling row, how the batter was out). {@code
     * credited} is how many such entries there are ({@code howOut} is null and {@code credited} 0 when none). Which types a
     * bowler is credited with is decided by {@code DismissalType.isBowlerCredited()} in {@code PlayerStatsCalculator}, never
     * in SQL.
     */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select ap.mrid as "resultId",
                   bw.id as "bowlingEntryId",
                   bw.wickets as "wickets",
                   be.how_out as "howOut",
                   count(be.id) as "credited"
            from ap
            join bowling_entry bw on bw.result_player_id = ap.rpid
            join match_innings i on i.id = bw.match_innings_id and i.kind = 'REGULAR'
            left join batting_entry be on be.match_innings_id = i.id and be.bowler_result_player_id = ap.rpid
                                      and be.how_out is not null
            where ap.mrid in (:resultIds)
            group by ap.mrid, bw.id, bw.wickets, be.how_out
            order by ap.mrid, bw.id
            """, nativeQuery = true)
    List<BowlingCreditView> bowlingCredits(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("resultIds") Collection<UUID> resultIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /** The default scope: every counted appearance (no Player Hub flag), any match. */
    default List<BowlingCreditView> bowlingCredits(
            UUID clubId,
            UUID playerId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            boolean sectionRestricted,
            Collection<UUID> sectionTeamIds,
            Collection<UUID> resultIds) {
        return bowlingCredits(clubId, playerId, seasonId, leagueId, teamId, competition, sectionRestricted, sectionTeamIds, resultIds, false, null);
    }

    /**
     * docs/specs/147: the player's counted batting rows for the listed matches with what the Player Hub stats cards need and
     * the match list lacks: the innings sequence (1 = first innings), the batting position, the fours and sixes, the bowler
     * who dismissed the batter as recorded (null when none is named), the season, and the field facts ({@code fieldKnown}:
     * the result or match names a playing area; {@code clubField}: that area is one of the club's own home fields). Ordered
     * by match then innings sequence. Only stored columns are selected; every figure is the calculator's.
     */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select ap.mrid as "resultId",
                   i.sequence as "inningsSequence",
                   be.position as "position",
                   be.runs as "runs",
                   case when\s""" + PlayerStatsSql.VALID_BALLS + """

                        then be.balls end as "balls",
                   be.fours as "fours",
                   be.sixes as "sixes",
                   be.how_out as "howOut",
                   coalesce(nullif(trim(brp.display_name), ''),
                            nullif(trim(concat_ws(' ', bper.first_name, bper.last_name)), '')) as "bowlerName",
                   dm.season_id as "seasonId",
                   (coalesce(dr.playing_area_id, dm.playing_area_id) is not null) as "fieldKnown",
                   exists (select 1 from club_playing_area cpa
                           where cpa.club_id = :clubId and cpa.is_home
                             and cpa.playing_area_id = coalesce(dr.playing_area_id, dm.playing_area_id)) as "clubField",
                   pa.id as "areaId",
                   pa.name as "areaName"
            from ap
            join match dm on dm.id = ap.match_id
            join match_result dr on dr.id = ap.mrid
            left join playing_area pa on pa.id = coalesce(dr.playing_area_id, dm.playing_area_id)
            join batting_entry be on be.result_player_id = ap.rpid
            join match_innings i on i.id = be.match_innings_id and i.kind = 'REGULAR'
            left join result_player brp on brp.id = be.bowler_result_player_id
            left join player_profile bpp on bpp.id = brp.player_profile_id
            left join person bper on bper.id = bpp.person_id
            where\s""" + PlayerStatsSql.COUNTED_BATTING_ROW + """

              and ap.mrid in (:resultIds)
            order by ap.mrid, i.sequence, be.id
            """, nativeQuery = true)
    List<BattingDetailView> battingDetail(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("resultIds") Collection<UUID> resultIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /**
     * docs/specs/147 amendment 2: the playing area of each listed counted match (null area when none is recorded) and whether
     * it is one of the club's own home fields (the same rule as {@code battingDetail}). One row per match.
     */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select distinct ap.mrid as "resultId",
                   pa.id as "areaId",
                   pa.name as "areaName",
                   exists (select 1 from club_playing_area cpa
                           where cpa.club_id = :clubId and cpa.is_home
                             and cpa.playing_area_id = pa.id) as "clubField"
            from ap
            join match dm on dm.id = ap.match_id
            join match_result dr on dr.id = ap.mrid
            left join playing_area pa on pa.id = coalesce(dr.playing_area_id, dm.playing_area_id)
            where ap.mrid in (:resultIds)
            """, nativeQuery = true)
    List<ResultVenueView> resultVenues(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("resultIds") Collection<UUID> resultIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /**
     * docs/specs/147: the batters the player dismissed (batting rows that name the player as the bowler) in the listed
     * matches: the batter's position, how the batter was out, and the name of our fielder when one is named (null for an
     * opposition fielder or none). Which types a bowler is credited with is {@code DismissalType.isBowlerCredited()}, applied
     * in the calculator.
     */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select ap.mrid as "resultId",
                   be.position as "position",
                   be.how_out as "howOut",
                   case when frp.opposition then null
                        else coalesce(nullif(trim(frp.display_name), ''),
                                      nullif(trim(concat_ws(' ', fper.first_name, fper.last_name)), '')) end as "fielderName"
            from ap
            join batting_entry be on be.bowler_result_player_id = ap.rpid
            join match_innings i on i.id = be.match_innings_id and i.kind = 'REGULAR'
            left join result_player frp on frp.id = be.fielder_result_player_id
            left join player_profile fpp on fpp.id = frp.player_profile_id
            left join person fper on fper.id = fpp.person_id
            where be.how_out is not null
              and ap.mrid in (:resultIds)
            order by ap.mrid, i.sequence, be.id
            """, nativeQuery = true)
    List<WicketDetailView> wicketDetail(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("resultIds") Collection<UUID> resultIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    /**
     * docs/specs/147: the additive counters of the player per season (matches, batting innings, dismissals, runs, wickets) for
     * the "Season by season" card. The caller passes a null {@code seasonId} so the Season filter is ignored; every other
     * filter applies. Same counting rules as the aggregate (counted batting rows, stored wickets); the average is the
     * calculator's.
     */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            , per as (
              select ap.mrid as mrid, ap.match_id as match_id,
                     (select count(*) from batting_entry be
                        join match_innings binn on binn.id = be.match_innings_id and binn.kind = 'REGULAR'
                        where be.result_player_id = ap.rpid and\s""" + PlayerStatsSql.COUNTED_BATTING_ROW + """
) as innings,
                     (select count(*) from batting_entry be
                        join match_innings binn on binn.id = be.match_innings_id and binn.kind = 'REGULAR'
                        where be.result_player_id = ap.rpid and\s""" + PlayerStatsSql.COUNTED_BATTING_ROW + """

                          and be.how_out not in ('NOT_OUT', 'RETIRED_NOT_OUT')) as dismissals,
                     (select coalesce(sum(be.runs), 0) from batting_entry be
                        join match_innings binn on binn.id = be.match_innings_id and binn.kind = 'REGULAR'
                        where be.result_player_id = ap.rpid and\s""" + PlayerStatsSql.COUNTED_BATTING_ROW + """
) as runs,
                     (select coalesce(sum(bw.wickets), 0) from bowling_entry bw
                        join match_innings bwinn on bwinn.id = bw.match_innings_id and bwinn.kind = 'REGULAR'
                        where bw.result_player_id = ap.rpid) as wickets
              from ap
            )
            select sm.season_id as "seasonId",
                   count(distinct per.mrid) as "matches",
                   coalesce(sum(per.innings), 0) as "innings",
                   coalesce(sum(per.dismissals), 0) as "dismissals",
                   coalesce(sum(per.runs), 0) as "runs",
                   coalesce(sum(per.wickets), 0) as "wickets"
            from per
            join match sm on sm.id = per.match_id
            group by sm.season_id
            """, nativeQuery = true)
    List<SeasonCountersView> seasonCounters(
            @Param("clubId") UUID clubId,
            @Param("playerId") UUID playerId,
            @Param("seasonId") UUID seasonId,
            @Param("leagueId") UUID leagueId,
            @Param("teamId") UUID teamId,
            @Param("competition") String competition,
            @Param("sectionRestricted") boolean sectionRestricted,
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds,
            @Param("playerVisibleOnly") boolean playerVisibleOnly,
            @Param("matchId") UUID matchId);

    interface BattingDetailView {
        UUID getResultId();

        Integer getInningsSequence();

        Integer getPosition();

        Integer getRuns();

        Integer getBalls();

        Integer getFours();

        Integer getSixes();

        String getHowOut();

        String getBowlerName();

        UUID getSeasonId();

        Boolean getFieldKnown();

        Boolean getClubField();

        UUID getAreaId();

        String getAreaName();
    }

    interface ResultVenueView {
        UUID getResultId();

        UUID getAreaId();

        String getAreaName();

        Boolean getClubField();
    }

    interface WicketDetailView {
        UUID getResultId();

        Integer getPosition();

        String getHowOut();

        String getFielderName();
    }

    interface SeasonCountersView {
        UUID getSeasonId();

        Long getMatches();

        Long getInnings();

        Long getDismissals();

        Long getRuns();

        Long getWickets();
    }

    interface MatchHeaderView {
        UUID getResultId();

        UUID getMatchId();

        Long getMatchEpochMillis();

        Integer getBallsPerOver();

        String getOutcome();

        String getWinningSide();

        Boolean getDerby();

        Boolean getOnHome();

        Boolean getOnAway();

        UUID getLeagueId();

        String getLeagueName();

        UUID getHomeTeamId();

        String getHomeTeamName();

        UUID getAwayTeamId();

        String getAwayTeamName();

        String getOpponentName();

        Boolean getHasBattingCard();

        Boolean getHasBowlingCard();
    }

    interface MatchBattingView {
        UUID getResultId();

        Integer getRuns();

        Integer getBalls();

        Integer getFours();

        Integer getSixes();

        String getHowOut();
    }

    interface MatchBowlingView {
        UUID getResultId();

        Integer getBalls();

        Integer getMaidens();

        Integer getRuns();

        Integer getWickets();

        Integer getDots();

        Integer getWides();

        Integer getNoBalls();
    }

    interface BowlingCreditView {
        UUID getResultId();

        UUID getBowlingEntryId();

        Integer getWickets();

        String getHowOut();

        Long getCredited();
    }

    interface MatchFieldingView {
        UUID getResultId();

        Long getCatches();

        Long getStumpings();

        Long getRunOuts();
    }

    interface MatchAwardView {
        UUID getResultId();

        Long getPlayerOfMatch();

        Long getTeamPlayerOfMatch();
    }

    interface PlayerTeamView {
        UUID getPlayerId();

        String getTeamName();

        Long getTotal();
    }

    interface PlayerNameView {
        UUID getPlayerId();

        String getFirstName();

        String getLastName();

        Boolean getActive();
    }

    interface BestInningsView {
        UUID getPlayerId();

        UUID getMatchId();

        Long getMatchEpochMillis();

        String getOpponent();

        Integer getBalls();
    }

    interface FilterOptionView {
        UUID getSeasonId();

        UUID getLeagueId();

        UUID getTeamId();

        UUID getSectionId();

        String getCompetition();
    }

    interface InningsView {
        UUID getMatchId();

        Long getMatchEpochMillis();

        Integer getRuns();

        Boolean getNotOut();

        Integer getBalls();
    }

    interface SpellView {
        UUID getMatchId();

        Long getMatchEpochMillis();

        Integer getWickets();

        Integer getRuns();

        Integer getBalls();

        Integer getBallsPerOver();
    }

    interface PositionView {
        Integer getPosition();

        Long getInnings();

        Long getRuns();

        Long getDismissals();
    }

    interface DismissalCountView {
        String getType();

        Long getTotal();
    }
}
