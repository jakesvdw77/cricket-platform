package com.cricketlegend.repository;

/**
 * docs/specs/103-player-stats.md: the SQL fragments shared by {@link PlayerStatsAggregateRepository} and {@link
 * PlayerStatsFactsRepository}, so the "counted appearance" rules exist once. Every query that starts with
 * {@link #APPEARANCES} takes the same eight named parameters: {@code clubId}, {@code playerId}, {@code seasonId},
 * {@code leagueId}, {@code teamId}, {@code competition} (each optional, passed as null for "no filter"),
 * {@code sectionRestricted} and {@code sectionTeamIds} (a never-empty list: a sentinel when unrestricted).
 *
 * <p>Only sums and counts of stored columns happen in SQL (plus the two encoded maxima); a figure is defined by
 * {@code PlayerStatsCalculator} alone.
 */
final class PlayerStatsSql {

    private PlayerStatsSql() {}

    private static final String PUBLISHED = "r.status = '" + ResultVisibility.PUBLISHED_STATUS + "'";

    /**
     * {@code ap}: one row per counted appearance (docs/specs/103, "What counts"): a published result of the club,
     * played (decision 17), one of our rows, linked to a profile, not a substitute, not an unconfirmed import guess,
     * inside the filters. The row's side picks the team for the Team and Section filters.
     */
    static final String APPEARANCES = """
            with ap as (
              select rp.id as rpid, rp.player_profile_id as pid, rp.match_result_id as mrid, rp.side as side,
                     r.balls_per_over as bpo, r.outcome_type as outcome, r.winning_side as winning_side,
                     m.id as match_id, m.match_date as match_date,
                     coalesce(ht.club_id = r.club_id and awt.club_id = r.club_id, false) as derby
              from result_player rp
              join match_result r on r.id = rp.match_result_id
              join match m on m.id = r.match_id
              left join team ht on ht.id = m.home_team_id
              left join team awt on awt.id = m.away_team_id
              where r.club_id = :clubId
                and\s""" + PUBLISHED + """

                and rp.opposition = false
                and rp.player_profile_id is not null
                and rp.substitute = false
                and rp.import_match is null
                and (r.outcome_type in ('WON', 'TIE', 'DRAW')
                     or (r.outcome_type in ('NO_RESULT', 'ABANDONED')
                         and (exists (select 1 from match_innings pinn
                                      where pinn.match_result_id = r.id and pinn.kind = 'REGULAR' and pinn.balls > 0)
                              or exists (select 1 from bowling_entry pbw
                                         join match_innings pbinn on pbinn.id = pbw.match_innings_id
                                         where pbinn.match_result_id = r.id and pbinn.kind = 'REGULAR'
                                           and pbw.balls > 0))))
                and (cast(:playerId as uuid) is null or rp.player_profile_id = cast(:playerId as uuid))
                and (cast(:seasonId as uuid) is null or m.season_id = cast(:seasonId as uuid))
                and (cast(:leagueId as uuid) is null or m.league_id = cast(:leagueId as uuid))
                and (cast(:competition as text) is null
                     or (cast(:competition as text) = 'LEAGUE' and m.league_id is not null)
                     or (cast(:competition as text) = 'FRIENDLY' and m.league_id is null))
                and (cast(:teamId as uuid) is null
                     or (rp.side = 'HOME' and m.home_team_id = cast(:teamId as uuid))
                     or (rp.side = 'AWAY' and m.away_team_id = cast(:teamId as uuid)))
                and (:sectionRestricted = false
                     or (rp.side = 'HOME' and m.home_team_id in (:sectionTeamIds))
                     or (rp.side = 'AWAY' and m.away_team_id in (:sectionTeamIds)))
            )
            """;

    /**
     * Every counter of every player in the filtered scope, one row per player with at least one counted appearance
     * (docs/specs/103, "Shape of the read" point 1). Batting figures count only rows that batted ({@code how_out}
     * set and not {@code DID_NOT_BAT}); "valid balls" excludes a 0-ball innings that scored runs (balls not recorded).
     */
    static final String AGGREGATE = APPEARANCES + """
            , app as (
              select x.pid as pid,
                     count(distinct x.mrid) as matches,
                     count(distinct x.mrid) filter (where x.has_bat) as bat_cards,
                     count(distinct x.mrid) filter (where x.has_bowl) as bowl_cards
              from (
                select ap.pid, ap.mrid,
                       exists (select 1 from match_innings ci
                               join batting_entry cb on cb.match_innings_id = ci.id
                               where ci.match_result_id = ap.mrid and ci.kind = 'REGULAR'
                                 and ci.batting_side = ap.side) as has_bat,
                       exists (select 1 from match_innings wi
                               join bowling_entry wb on wb.match_innings_id = wi.id
                               where wi.match_result_id = ap.mrid and wi.kind = 'REGULAR'
                                 and wi.batting_side <> ap.side) as has_bowl
                from ap) x
              group by x.pid
            ),
            bi as (
              select ap.pid as pid, be.runs as runs, be.balls as balls, be.fours as fours, be.sixes as sixes,
                     be.how_out as how_out,
                     (be.how_out in ('NOT_OUT', 'RETIRED_NOT_OUT')) as not_out,
                     (be.balls is not null and not (be.balls = 0 and coalesce(be.runs, 0) > 0)) as vb
              from ap
              join batting_entry be on be.result_player_id = ap.rpid
              join match_innings binn on binn.id = be.match_innings_id and binn.kind = 'REGULAR'
              where be.how_out is not null and be.how_out <> 'DID_NOT_BAT'
            ),
            bat as (
              select pid,
                     count(*) as innings,
                     count(*) filter (where not_out) as not_outs,
                     count(*) filter (where not not_out) as dismissals,
                     coalesce(sum(runs), 0) as runs,
                     coalesce(sum(balls) filter (where vb), 0) as balls_faced,
                     count(*) filter (where vb) as innings_with_balls,
                     coalesce(sum(runs) filter (where vb), 0) as runs_with_balls,
                     coalesce(sum(fours), 0) as fours,
                     coalesce(sum(sixes), 0) as sixes,
                     count(*) filter (where fours is not null and sixes is not null) as innings_with_boundaries,
                     coalesce(sum(4 * fours + 6 * sixes) filter (where fours is not null and sixes is not null), 0)
                         as boundary_runs,
                     coalesce(sum(runs) filter (where fours is not null and sixes is not null), 0)
                         as runs_with_boundaries,
                     coalesce(sum(balls) filter (where vb and fours is not null and sixes is not null), 0)
                         as balls_for_boundaries,
                     coalesce(sum(fours + sixes) filter (where vb and fours is not null and sixes is not null), 0)
                         as boundary_count,
                     count(*) filter (where not not_out and how_out <> 'RETIRED_OUT' and runs = 0) as ducks,
                     count(*) filter (where not not_out and how_out <> 'RETIRED_OUT' and runs = 0 and balls = 1)
                         as golden_ducks,
                     count(*) filter (where runs >= 30) as thirty_plus,
                     count(*) filter (where runs >= 50) as fifty_plus,
                     count(*) filter (where runs >= 100) as hundred_plus,
                     count(*) filter (where runs >= 100) as centuries,
                     count(*) filter (where runs >= 50 and runs <= 99) as half_centuries,
                     max(cast(runs as bigint) * 2 + case when not_out then 1 else 0 end) as highest_key
              from bi
              group by pid
            ),
            bwi as (
              select ap.pid as pid, ap.bpo as bpo, bw.balls as balls, bw.runs as runs, bw.wickets as wickets,
                     bw.maidens as maidens, bw.wides as wides, bw.no_balls as no_balls, bw.dots as dots,
                     (bw.balls > 0 or bw.runs > 0) as counted
              from ap
              join bowling_entry bw on bw.result_player_id = ap.rpid
              join match_innings bwinn on bwinn.id = bw.match_innings_id and bwinn.kind = 'REGULAR'
            ),
            bowl as (
              select pid,
                     count(*) filter (where counted) as innings_bowled,
                     coalesce(sum(balls), 0) as balls,
                     coalesce(sum(runs), 0) as runs,
                     coalesce(sum(wickets), 0) as wickets,
                     coalesce(sum(maidens), 0) as maidens,
                     coalesce(sum(wides), 0) as wides,
                     coalesce(sum(no_balls), 0) as no_balls,
                     coalesce(sum(dots), 0) as dots,
                     count(*) filter (where counted and wides is not null) as innings_with_wides,
                     count(*) filter (where counted and no_balls is not null) as innings_with_no_balls,
                     count(*) filter (where counted and dots is not null) as innings_with_dots,
                     coalesce(sum(balls) filter (where dots is not null), 0) as balls_with_dots,
                     coalesce(sum(cast(balls as numeric) / bpo), 0) as overs,
                     string_agg(distinct cast(bpo as text), ',') filter (where balls > 0) as balls_per_over,
                     count(*) filter (where wickets = 3) as three_wickets,
                     count(*) filter (where wickets = 4) as four_wickets,
                     count(*) filter (where wickets >= 5) as five_wickets,
                     max(case when counted
                              then cast(wickets as bigint) * 10000000000
                                   + cast(99999 - least(runs, 99999) as bigint) * 100000
                                   + least(balls, 99999)
                         end) as best_key
              from bwi
              group by pid
            ),
            fld as (
              select ap.pid as pid,
                     coalesce(sum(fe.catches), 0) as catches,
                     coalesce(sum(fe.stumpings), 0) as stumpings,
                     coalesce(sum(fe.run_outs), 0) as run_outs
              from ap
              join fielding_entry fe on fe.result_player_id = ap.rpid
              join match_innings finn on finn.id = fe.match_innings_id and finn.kind = 'REGULAR'
              group by ap.pid
            ),
            awd as (
              select ap.pid as pid,
                     count(*) filter (where ma.award_type = 'PLAYER_OF_MATCH') as potm,
                     count(*) filter (where ma.award_type = 'TEAM_PLAYER_OF_MATCH') as team_potm
              from ap
              join match_award ma on ma.result_player_id = ap.rpid
              group by ap.pid
            ),
            rec as (
              select pid,
                     count(distinct mrid) filter (where not derby and outcome = 'WON' and winning_side = side) as won,
                     count(distinct mrid) filter (where not derby and outcome = 'WON' and winning_side <> side)
                         as lost,
                     count(distinct mrid) filter (where not derby and outcome = 'TIE') as tied,
                     count(distinct mrid) filter (where not derby and outcome = 'DRAW') as drawn,
                     count(distinct mrid) filter (where derby) as internal
              from ap
              group by pid
            )
            select app.pid as "playerId",
                   app.matches as "matches",
                   app.bat_cards as "resultsWithBattingCard",
                   app.bowl_cards as "resultsWithBowlingCard",
                   coalesce(bat.innings, 0) as "batInnings",
                   coalesce(bat.not_outs, 0) as "batNotOuts",
                   coalesce(bat.dismissals, 0) as "batDismissals",
                   coalesce(bat.runs, 0) as "batRuns",
                   coalesce(bat.balls_faced, 0) as "batBallsFaced",
                   coalesce(bat.innings_with_balls, 0) as "batInningsWithBalls",
                   coalesce(bat.runs_with_balls, 0) as "batRunsWithBalls",
                   coalesce(bat.fours, 0) as "batFours",
                   coalesce(bat.sixes, 0) as "batSixes",
                   coalesce(bat.innings_with_boundaries, 0) as "batInningsWithBoundaries",
                   coalesce(bat.boundary_runs, 0) as "batBoundaryRuns",
                   coalesce(bat.runs_with_boundaries, 0) as "batRunsWithBoundaries",
                   coalesce(bat.balls_for_boundaries, 0) as "batBallsForBoundaries",
                   coalesce(bat.boundary_count, 0) as "batBoundaryCount",
                   coalesce(bat.ducks, 0) as "batDucks",
                   coalesce(bat.golden_ducks, 0) as "batGoldenDucks",
                   coalesce(bat.thirty_plus, 0) as "batThirtyPlus",
                   coalesce(bat.fifty_plus, 0) as "batFiftyPlus",
                   coalesce(bat.hundred_plus, 0) as "batHundredPlus",
                   coalesce(bat.centuries, 0) as "batCenturies",
                   coalesce(bat.half_centuries, 0) as "batHalfCenturies",
                   bat.highest_key as "batHighestKey",
                   coalesce(bowl.innings_bowled, 0) as "bowlInnings",
                   coalesce(bowl.balls, 0) as "bowlBalls",
                   coalesce(bowl.runs, 0) as "bowlRuns",
                   coalesce(bowl.wickets, 0) as "bowlWickets",
                   coalesce(bowl.maidens, 0) as "bowlMaidens",
                   coalesce(bowl.wides, 0) as "bowlWides",
                   coalesce(bowl.no_balls, 0) as "bowlNoBalls",
                   coalesce(bowl.dots, 0) as "bowlDots",
                   coalesce(bowl.innings_with_wides, 0) as "bowlInningsWithWides",
                   coalesce(bowl.innings_with_no_balls, 0) as "bowlInningsWithNoBalls",
                   coalesce(bowl.innings_with_dots, 0) as "bowlInningsWithDots",
                   coalesce(bowl.balls_with_dots, 0) as "bowlBallsWithDots",
                   coalesce(bowl.overs, 0) as "bowlOvers",
                   bowl.balls_per_over as "bowlBallsPerOver",
                   coalesce(bowl.three_wickets, 0) as "bowlThreeWickets",
                   coalesce(bowl.four_wickets, 0) as "bowlFourWickets",
                   coalesce(bowl.five_wickets, 0) as "bowlFiveWickets",
                   bowl.best_key as "bowlBestKey",
                   coalesce(fld.catches, 0) as "fieldCatches",
                   coalesce(fld.stumpings, 0) as "fieldStumpings",
                   coalesce(fld.run_outs, 0) as "fieldRunOuts",
                   coalesce(awd.potm, 0) as "awardPlayerOfMatch",
                   coalesce(awd.team_potm, 0) as "awardTeamPlayerOfMatch",
                   coalesce(rec.won, 0) as "recWon",
                   coalesce(rec.lost, 0) as "recLost",
                   coalesce(rec.tied, 0) as "recTied",
                   coalesce(rec.drawn, 0) as "recDrawn",
                   coalesce(rec.internal, 0) as "recInternal"
            from app
            left join bat on bat.pid = app.pid
            left join bowl on bowl.pid = app.pid
            left join fld on fld.pid = app.pid
            left join awd on awd.pid = app.pid
            left join rec on rec.pid = app.pid
            """;
}
