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
 * parameters as {@link PlayerStatsAggregateRepository} (see {@link PlayerStatsSql}); always for one {@code playerId}.
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
                   case when be.balls is not null and not (be.balls = 0 and coalesce(be.runs, 0) > 0)
                        then be.balls end as "balls"
            from ap
            join batting_entry be on be.result_player_id = ap.rpid
            join match_innings i on i.id = be.match_innings_id and i.kind = 'REGULAR'
            where be.how_out is not null and be.how_out <> 'DID_NOT_BAT'
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
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds);

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
            where bw.balls > 0 or bw.runs > 0
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
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds);

    /** Innings, runs and dismissals per actual batting position (rows without a position are left out). */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select be.position as "position",
                   count(*) as "innings",
                   coalesce(sum(be.runs), 0) as "runs",
                   count(*) filter (where be.how_out not in ('NOT_OUT', 'RETIRED_NOT_OUT')) as "dismissals"
            from ap
            join batting_entry be on be.result_player_id = ap.rpid
            join match_innings i on i.id = be.match_innings_id and i.kind = 'REGULAR'
            where be.how_out is not null and be.how_out <> 'DID_NOT_BAT' and be.position is not null
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
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds);

    /** How the player's own innings ended, as stored ({@code how_out}), with a count each. */
    @Query(value = PlayerStatsSql.APPEARANCES + """
            select be.how_out as "type", count(*) as "total"
            from ap
            join batting_entry be on be.result_player_id = ap.rpid
            join match_innings i on i.id = be.match_innings_id and i.kind = 'REGULAR'
            where be.how_out is not null and be.how_out <> 'DID_NOT_BAT'
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
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds);

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
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds);

    /**
     * The distinct season, league, own-side team (of this club), its section and competition type across the player's
     * counted appearances. Pass null for the four optional filters: the options are never narrowed by them.
     */
    @Query(value = PlayerStatsSql.APPEARANCES + """
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
            @Param("sectionTeamIds") Collection<UUID> sectionTeamIds);

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
