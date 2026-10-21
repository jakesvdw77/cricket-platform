package com.cricketlegend.repository;

/**
 * docs/specs/116-team-stats.md, "SQL approach": the SQL fragments shared by {@link TeamStatsAggregateRepository} and {@link
 * TeamStatsFactsRepository}, so the "counted team result" rules exist once. Every query that starts with {@link
 * #TEAM_RESULTS} takes the same seven named parameters: {@code clubId}, {@code seasonId}, {@code leagueId}, {@code teamId},
 * {@code competition} (each optional, passed as null for "no filter"), {@code sectionRestricted} and {@code sectionTeamIds}
 * (a never-empty list: a sentinel when unrestricted). It is {@link PlayerStatsSql}'s idiom without {@code playerId}.
 *
 * <p>Only sums, counts and encoded maxima/minima of stored columns happen in SQL; a figure is defined by {@code
 * TeamStatsCalculator} alone. The published and played predicates come from {@link StatsCountingSql}. The classification
 * predicates that go beyond comparing one stored column with another (a complete innings, a successful chase, a usable
 * Net Run Rate result) are the named constants below, mirrored by the calculator's unit-tested definitions.
 *
 * <h2>Encoded keys (decoded by {@code TeamStatsCalculator})</h2>
 * Every key is a non-negative {@code numeric} integer so a plain {@code max} or {@code min} picks the winner and its
 * tie-breaks. {@code E} is the match date in whole epoch seconds (10 digits); {@code Einv} is {@code 9999999999 - E}.
 * <ul>
 *   <li>highest total: {@code runs * 10^13 + E * 10^3 + allOut * 100 + min(wickets, 99)} (max)</li>
 *   <li>lowest complete total: the same with {@code Einv} (min: fewest runs, then the most recent match)</li>
 *   <li>highest chase: {@code runs * 10^21 + E * 10^11 + target * 10^2 + min(wickets, 99)} (max)</li>
 *   <li>largest victory by runs: {@code margin * 10^10 + E} (max)</li>
 *   <li>largest victory by wickets: {@code margin * 10^18 + (ballsRemaining + 1) * 10^10 + E} (max; 0 = unknown)</li>
 * </ul>
 */
final class TeamStatsSql {

    private TeamStatsSql() {}

    // ---- classification predicates (named, defined once) ----

    /** An innings is usable for runs figures: runs, wickets and balls are all recorded (alias {@code i}). */
    static final String USABLE_INNINGS = "i.runs is not null and i.wickets is not null and i.balls is not null";

    /** Highs and lows come only from results with an outcome that stands (alias {@code ti}). */
    static final String HIGH_LOW_RESULT = "ti.outcome in ('WON', 'TIE', 'DRAW')";

    /**
     * A complete innings (alias {@code ti}): ended all out, or used its full scheduled quota (known). A DLS-decided result
     * counts only when all out.
     */
    static final String COMPLETE_INNINGS =
            "(ti.all_out or (ti.decided_by <> 'DLS' and ti.scheduled_balls is not null and ti.balls >= ti.scheduled_balls))";

    /** An innings whose completeness can be decided: all out, or the quota is known (alias {@code ti}). */
    static final String CLASSIFIABLE_INNINGS = "(ti.all_out or ti.scheduled_balls is not null)";

    /**
     * A successful chase (aliases {@code ti} = the team's innings, {@code pv} = the opposition innings it chased): a
     * regular win, two regular innings, the team batted second, both innings usable.
     */
    static final String SUCCESSFUL_CHASE =
            "ti.own and not pv.own and ti.outcome = 'WON' and ti.winning_side = ti.side and ti.decided_by = 'REGULAR'"
                    + " and ti.inn_count = 2 and ti.sequence = ti.last_seq and pv.sequence < ti.sequence"
                    + " and ti.usable and pv.usable";

    /**
     * A result that may feed Net Run Rate (alias {@code rs}): WON or TIE, not decided by DLS, in a league, exactly one
     * regular innings each way, both usable, and the scheduled quota known for any all-out innings.
     */
    static final String NRR_RESULT =
            "rs.outcome in ('WON', 'TIE') and rs.decided_by <> 'DLS' and rs.league_id is not null"
                    + " and rs.n_inn = 2 and rs.n_own = 1 and rs.n_opp = 1 and rs.all_usable and rs.quota_known";

    // ---- encoded keys ----

    private static final String EPOCH_TI = "trunc(cast(extract(epoch from ti.match_date) as numeric))";
    private static final String EPOCH_TR = "trunc(cast(extract(epoch from tr.match_date) as numeric))";
    private static final String INNINGS_TAIL = "(case when ti.all_out then 100 else 0 end) + least(ti.wickets, 99)";

    static final String HIGH_TOTAL_KEY =
            "cast(ti.runs as numeric) * 10000000000000 + " + EPOCH_TI + " * 1000 + " + INNINGS_TAIL;

    static final String LOW_TOTAL_KEY =
            "cast(ti.runs as numeric) * 10000000000000 + (9999999999 - " + EPOCH_TI + ") * 1000 + " + INNINGS_TAIL;

    static final String CHASE_KEY = "cast(ti.runs as numeric) * 1000000000000000000000 + " + EPOCH_TI
            + " * 100000000000 + cast(pv.runs + 1 as numeric) * 100 + least(ti.wickets, 99)";

    static final String VICTORY_RUNS_KEY = "cast(tr.margin_value as numeric) * 10000000000 + " + EPOCH_TR;

    static final String VICTORY_WICKETS_KEY = "cast(tr.margin_value as numeric) * 1000000000000000000"
            + " + (coalesce(case when ti.balls is not null and tr.scheduled_balls is not null"
            + " then greatest(tr.scheduled_balls - ti.balls, 0) end, -1) + 1) * 10000000000 + " + EPOCH_TR;

    // ---- the counted team results ----

    /**
     * {@code tra}: one row per (published result, side) where the side's team is set and belongs to the club, inside the
     * filters, with {@code counted} = played (docs/specs/103 decision 17) or a forfeit (116 decision 15). {@code tr}: the
     * counted rows only. A derby gives two rows, one per team. The Section filter and a section-scoped caller's reach
     * choose which TEAMS appear (by team id); the innings of the other side are read by match, never by team.
     */
    static final String TEAM_RESULTS = """
            with tra as (
              select r.id as mrid, m.id as match_id, m.match_date as match_date, s.side as side, t.id as team_id,
                     t.section_id as section_id, r.outcome_type as outcome, r.winning_side as winning_side,
                     r.decided_by as decided_by, r.margin_type as margin_type, r.margin_value as margin_value,
                     r.balls_per_over as bpo, r.scheduled_balls as scheduled_balls,
                     m.league_id as league_id, m.season_id as season_id,
                     coalesce(ht.club_id = r.club_id and awt.club_id = r.club_id, false) as derby,
                     (\
            """ + StatsCountingSql.PLAYED_RESULT + """
             or r.outcome_type = 'FORFEIT') as counted
              from match_result r
              join match m on m.id = r.match_id
              cross join (values ('HOME'), ('AWAY')) as s(side)
              join team t on t.id = case when s.side = 'HOME' then m.home_team_id else m.away_team_id end
                         and t.club_id = r.club_id
              left join team ht on ht.id = m.home_team_id
              left join team awt on awt.id = m.away_team_id
              where r.club_id = :clubId
                and\s""" + StatsCountingSql.PUBLISHED + """

                and (cast(:seasonId as uuid) is null or m.season_id = cast(:seasonId as uuid))
                and (cast(:leagueId as uuid) is null or m.league_id = cast(:leagueId as uuid))
                and (cast(:competition as text) is null
                     or (cast(:competition as text) = 'LEAGUE' and m.league_id is not null)
                     or (cast(:competition as text) = 'FRIENDLY' and m.league_id is null))
                and (cast(:teamId as uuid) is null or t.id = cast(:teamId as uuid))
                and (:sectionRestricted = false or t.id in (:sectionTeamIds))
            ),
            tr as (select * from tra where counted)
            """;

    /**
     * {@code ti}: one row per (counted non-forfeit team result, regular innings), flagged {@code own} when the team batted.
     * A forfeit is excluded by its outcome, never by missing innings (a forfeit may carry stray innings that must never be
     * read). Rows are never multiplied: each innings appears once per team result. {@code inn_count} and {@code last_seq}
     * describe the team result's regular innings.
     */
    static final String TEAM_INNINGS = TEAM_RESULTS + """
            , ti as (
              select tr.team_id as team_id, tr.mrid as mrid, tr.side as side, tr.match_date as match_date,
                     tr.outcome as outcome, tr.winning_side as winning_side, tr.decided_by as decided_by,
                     tr.margin_type as margin_type, tr.margin_value as margin_value, tr.bpo as bpo,
                     tr.scheduled_balls as scheduled_balls, tr.league_id as league_id, tr.season_id as season_id,
                     (i.batting_side = tr.side) as own, i.sequence as sequence, i.runs as runs, i.wickets as wickets,
                     i.balls as balls, i.all_out as all_out, i.extras as extras, i.wides as wides,
                     i.no_balls as no_balls, i.byes as byes, i.leg_byes as leg_byes, i.penalty_runs as penalty_runs,
                     (""" + USABLE_INNINGS + """
            ) as usable,
                     count(*) over (partition by tr.team_id, tr.mrid, tr.side) as inn_count,
                     max(i.sequence) over (partition by tr.team_id, tr.mrid, tr.side) as last_seq
              from tr
              join match_innings i on i.match_result_id = tr.mrid and i.kind = 'REGULAR'
              where tr.outcome <> 'FORFEIT'
            )
            """;

    /**
     * Every additive counter of every team with a counted result in the filtered scope, one row per team
     * (docs/specs/116, "SQL approach" point 3). Separate CTEs over {@code tr} and {@code ti}, joined by team id at the end.
     */
    static final String AGGREGATE = TEAM_INNINGS + """
            , rec as (
              select tr.team_id as team_id,
                     count(*) as results,
                     count(*) filter (where tr.outcome = 'WON' and tr.winning_side = tr.side) as won,
                     count(*) filter (where tr.outcome = 'WON' and tr.winning_side <> tr.side) as lost,
                     count(*) filter (where tr.outcome = 'TIE') as tied,
                     count(*) filter (where tr.outcome = 'DRAW') as drawn,
                     count(*) filter (where tr.outcome in ('NO_RESULT', 'ABANDONED')) as no_result,
                     count(*) filter (where tr.outcome = 'FORFEIT' and tr.winning_side = tr.side) as forfeits_received,
                     count(*) filter (where tr.outcome = 'FORFEIT' and tr.winning_side <> tr.side) as forfeits_conceded,
                     count(*) filter (where tr.derby) as internal
              from tr
              group by tr.team_id
            ),
            nb as (
              select tra.team_id as team_id, count(*) as no_ball
              from tra
              where not tra.counted and tra.outcome in ('NO_RESULT', 'ABANDONED')
              group by tra.team_id
            ),
            inn as (
              select ti.team_id as team_id,
                     count(*) filter (where ti.own) as own_innings,
                     count(*) filter (where ti.own and ti.usable) as own_usable,
                     coalesce(sum(ti.runs) filter (where ti.own and ti.usable), 0) as own_runs,
                     coalesce(sum(ti.wickets) filter (where ti.own and ti.usable), 0) as own_wickets,
                     coalesce(sum(ti.balls) filter (where ti.own and ti.usable), 0) as own_balls,
                     coalesce(sum(ti.runs) filter (where ti.own and ti.usable and ti.balls > 0), 0)
                         as own_runs_with_balls,
                     coalesce(sum(cast(ti.balls as numeric) / ti.bpo) filter (where ti.own and ti.usable and ti.balls > 0), 0)
                         as own_overs,
                     max(""" + HIGH_TOTAL_KEY + """
            ) filter (where ti.own and ti.usable and\s""" + HIGH_LOW_RESULT + """
            ) as high_key,
                     min(""" + LOW_TOTAL_KEY + """
            ) filter (where ti.own and ti.usable and\s""" + HIGH_LOW_RESULT + """
             and\s""" + COMPLETE_INNINGS + """
            ) as low_key,
                     count(*) filter (where ti.own and ti.usable and\s""" + HIGH_LOW_RESULT + """
            ) as high_low_innings,
                     count(*) filter (where ti.own and ti.usable and\s""" + HIGH_LOW_RESULT + """
             and\s""" + CLASSIFIABLE_INNINGS + """
            ) as low_classifiable,
                     count(*) filter (where not ti.own) as opp_innings,
                     count(*) filter (where not ti.own and ti.usable) as opp_usable,
                     coalesce(sum(ti.runs) filter (where not ti.own and ti.usable), 0) as opp_runs,
                     coalesce(sum(ti.wickets) filter (where not ti.own and ti.usable), 0) as opp_wickets,
                     coalesce(sum(ti.balls) filter (where not ti.own and ti.usable), 0) as opp_balls,
                     coalesce(sum(ti.runs) filter (where not ti.own and ti.usable and ti.balls > 0), 0)
                         as opp_runs_with_balls,
                     coalesce(sum(cast(ti.balls as numeric) / ti.bpo)
                         filter (where not ti.own and ti.usable and ti.balls > 0), 0) as opp_overs,
                     count(*) filter (where not ti.own and ti.extras is not null) as extras_innings,
                     coalesce(sum(ti.extras) filter (where not ti.own), 0) as extras,
                     count(*) filter (where not ti.own and ti.wides is not null) as wides_innings,
                     coalesce(sum(ti.wides) filter (where not ti.own), 0) as wides,
                     count(*) filter (where not ti.own and ti.no_balls is not null) as no_balls_innings,
                     coalesce(sum(ti.no_balls) filter (where not ti.own), 0) as no_balls,
                     count(*) filter (where not ti.own and ti.byes is not null) as byes_innings,
                     coalesce(sum(ti.byes) filter (where not ti.own), 0) as byes,
                     count(*) filter (where not ti.own and ti.leg_byes is not null) as leg_byes_innings,
                     coalesce(sum(ti.leg_byes) filter (where not ti.own), 0) as leg_byes,
                     count(*) filter (where not ti.own and ti.penalty_runs is not null) as penalty_innings,
                     coalesce(sum(ti.penalty_runs) filter (where not ti.own), 0) as penalty_runs
              from ti
              group by ti.team_id
            ),
            ch as (
              select ti.team_id as team_id, max(""" + CHASE_KEY + """
            ) as chase_key
              from ti
              join ti pv on pv.team_id = ti.team_id and pv.mrid = ti.mrid and pv.side = ti.side
              where\s""" + SUCCESSFUL_CHASE + """

              group by ti.team_id
            ),
            vr as (
              select tr.team_id as team_id, max(""" + VICTORY_RUNS_KEY + """
            ) as victory_runs_key
              from tr
              where tr.outcome = 'WON' and tr.winning_side = tr.side and tr.decided_by = 'REGULAR'
                and tr.margin_type = 'RUNS' and tr.margin_value is not null
              group by tr.team_id
            ),
            vw as (
              select tr.team_id as team_id, max(""" + VICTORY_WICKETS_KEY + """
            ) as victory_wickets_key
              from tr
              left join ti on ti.team_id = tr.team_id and ti.mrid = tr.mrid and ti.side = tr.side
                          and ti.own and ti.sequence = ti.last_seq
              where tr.outcome = 'WON' and tr.winning_side = tr.side and tr.decided_by = 'REGULAR'
                and tr.margin_type = 'WICKETS' and tr.margin_value is not null
              group by tr.team_id
            ),
            rs as (
              select ti.team_id as team_id, ti.mrid as mrid, ti.side as side, ti.outcome as outcome,
                     ti.decided_by as decided_by, ti.league_id as league_id, ti.season_id as season_id,
                     count(*) as n_inn,
                     count(*) filter (where ti.own) as n_own,
                     count(*) filter (where not ti.own) as n_opp,
                     count(*) filter (where ti.own and ti.usable) as own_usable,
                     count(*) filter (where not ti.own and ti.usable) as opp_usable,
                     bool_and(ti.usable) as all_usable,
                     bool_and(not ti.all_out or ti.scheduled_balls is not null) as quota_known,
                     coalesce(sum(ti.runs) filter (where ti.own), 0) as own_runs,
                     coalesce(sum(ti.runs) filter (where not ti.own), 0) as opp_runs,
                     sum(cast(case when ti.all_out then ti.scheduled_balls else ti.balls end as numeric) / ti.bpo)
                         filter (where ti.own) as own_overs,
                     sum(cast(case when ti.all_out then ti.scheduled_balls else ti.balls end as numeric) / ti.bpo)
                         filter (where not ti.own) as opp_overs
              from ti
              group by ti.team_id, ti.mrid, ti.side, ti.outcome, ti.decided_by, ti.league_id, ti.season_id
            ),
            rsa as (
              select rs.team_id as team_id,
                     count(*) filter (where rs.own_usable > 0 and rs.opp_usable > 0) as both_innings,
                     count(*) filter (where\s""" + NRR_RESULT + """
            ) as nrr_matches,
                     coalesce(sum(rs.own_runs) filter (where\s""" + NRR_RESULT + """
            ), 0) as nrr_own_runs,
                     coalesce(sum(rs.opp_runs) filter (where\s""" + NRR_RESULT + """
            ), 0) as nrr_opp_runs,
                     coalesce(sum(rs.own_overs) filter (where\s""" + NRR_RESULT + """
            ), 0) as nrr_own_overs,
                     coalesce(sum(rs.opp_overs) filter (where\s""" + NRR_RESULT + """
            ), 0) as nrr_opp_overs,
                     count(distinct rs.league_id) filter (where\s""" + NRR_RESULT + """
            ) as nrr_leagues,
                     count(distinct rs.season_id) filter (where\s""" + NRR_RESULT + """
            ) as nrr_seasons,
                     (array_agg(rs.league_id) filter (where\s""" + NRR_RESULT + """
            ))[1] as nrr_league_id,
                     (array_agg(rs.season_id) filter (where\s""" + NRR_RESULT + """
            ))[1] as nrr_season_id
              from rs
              group by rs.team_id
            )
            select rec.team_id as "teamId",
                   t.name as "teamName",
                   t.section_id as "sectionId",
                   t.active as "active",
                   rec.results as "results",
                   rec.won as "recWon",
                   rec.lost as "recLost",
                   rec.tied as "recTied",
                   rec.drawn as "recDrawn",
                   rec.no_result as "recNoResult",
                   rec.forfeits_received as "recForfeitsReceived",
                   rec.forfeits_conceded as "recForfeitsConceded",
                   rec.internal as "recInternal",
                   coalesce(nb.no_ball, 0) as "noBallBowled",
                   coalesce(rsa.both_innings, 0) as "bothInnings",
                   coalesce(inn.own_innings, 0) as "ownInnings",
                   coalesce(inn.own_usable, 0) as "ownUsable",
                   coalesce(inn.own_runs, 0) as "ownRuns",
                   coalesce(inn.own_wickets, 0) as "ownWickets",
                   coalesce(inn.own_balls, 0) as "ownBalls",
                   coalesce(inn.own_runs_with_balls, 0) as "ownRunsWithBalls",
                   coalesce(inn.own_overs, 0) as "ownOvers",
                   inn.high_key as "highTotalKey",
                   inn.low_key as "lowTotalKey",
                   coalesce(inn.high_low_innings, 0) as "highLowInnings",
                   coalesce(inn.low_classifiable, 0) as "lowClassifiable",
                   coalesce(inn.opp_innings, 0) as "oppInnings",
                   coalesce(inn.opp_usable, 0) as "oppUsable",
                   coalesce(inn.opp_runs, 0) as "oppRuns",
                   coalesce(inn.opp_wickets, 0) as "oppWickets",
                   coalesce(inn.opp_balls, 0) as "oppBalls",
                   coalesce(inn.opp_runs_with_balls, 0) as "oppRunsWithBalls",
                   coalesce(inn.opp_overs, 0) as "oppOvers",
                   coalesce(inn.extras_innings, 0) as "extrasInnings",
                   coalesce(inn.extras, 0) as "extras",
                   coalesce(inn.wides_innings, 0) as "widesInnings",
                   coalesce(inn.wides, 0) as "wides",
                   coalesce(inn.no_balls_innings, 0) as "noBallsInnings",
                   coalesce(inn.no_balls, 0) as "noBalls",
                   coalesce(inn.byes_innings, 0) as "byesInnings",
                   coalesce(inn.byes, 0) as "byes",
                   coalesce(inn.leg_byes_innings, 0) as "legByesInnings",
                   coalesce(inn.leg_byes, 0) as "legByes",
                   coalesce(inn.penalty_innings, 0) as "penaltyInnings",
                   coalesce(inn.penalty_runs, 0) as "penaltyRuns",
                   ch.chase_key as "chaseKey",
                   vr.victory_runs_key as "victoryRunsKey",
                   vw.victory_wickets_key as "victoryWicketsKey",
                   coalesce(rsa.nrr_matches, 0) as "nrrMatches",
                   coalesce(rsa.nrr_own_runs, 0) as "nrrOwnRuns",
                   coalesce(rsa.nrr_opp_runs, 0) as "nrrOppRuns",
                   coalesce(rsa.nrr_own_overs, 0) as "nrrOwnOvers",
                   coalesce(rsa.nrr_opp_overs, 0) as "nrrOppOvers",
                   coalesce(rsa.nrr_leagues, 0) as "nrrLeagues",
                   coalesce(rsa.nrr_seasons, 0) as "nrrSeasons",
                   rsa.nrr_league_id as "nrrLeagueId",
                   rsa.nrr_season_id as "nrrSeasonId"
            from rec
            join team t on t.id = rec.team_id
            left join nb on nb.team_id = rec.team_id
            left join inn on inn.team_id = rec.team_id
            left join ch on ch.team_id = rec.team_id
            left join vr on vr.team_id = rec.team_id
            left join vw on vw.team_id = rec.team_id
            left join rsa on rsa.team_id = rec.team_id
            """;

    /**
     * What the table's basis line reports, once for the whole scope (a derby counts once here, not once per team): distinct
     * results with a counted team result, internal (derby) results among them, results left out for want of a ball
     * bowled, and forfeits among the counted ones.
     */
    static final String BASIS = TEAM_RESULTS + """
            select count(distinct tra.mrid) filter (where tra.counted) as "resultsCounted",
                   count(distinct tra.mrid) filter (where tra.counted and tra.derby) as "internalResults",
                   count(distinct tra.mrid) filter (where not tra.counted and tra.outcome in ('NO_RESULT', 'ABANDONED'))
                       as "resultsNoBallBowled",
                   count(distinct tra.mrid) filter (where tra.counted and tra.outcome = 'FORFEIT') as "forfeits"
            from tra
            """;

    /** The distinct season, league, section and competition across the counted team results (no team: the table lists them). */
    static final String FILTER_OPTIONS = TEAM_RESULTS + """
            select distinct tr.season_id as "seasonId",
                   tr.league_id as "leagueId",
                   cast(null as uuid) as "teamId",
                   tr.section_id as "sectionId",
                   case when tr.league_id is not null then 'LEAGUE' else 'FRIENDLY' end as "competition"
            from tr
            """;
}
