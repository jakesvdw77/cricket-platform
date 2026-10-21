package com.cricketlegend.repository;

/**
 * docs/specs/103-player-stats.md (decisions 2 and 17) and docs/specs/116-team-stats.md ("SQL approach" point 1): the two
 * counting predicates every statistics query shares, so what counts as "published" and "played" exists once. A change here
 * changes player and team statistics together. Both refer to the {@code match_result} alias {@code r}.
 */
final class StatsCountingSql {

    private StatsCountingSql() {}

    /** The publish gate, built from {@link ResultVisibility#PUBLISHED_STATUS}, never a re-typed string. */
    static final String PUBLISHED = "r.status = '" + ResultVisibility.PUBLISHED_STATUS + "'";

    /**
     * The "played" rule (103 decision 17): WON, TIE or DRAW, or NO_RESULT / ABANDONED with at least one ball bowled (a
     * {@code REGULAR} innings with {@code balls > 0}, or a bowling entry with {@code balls > 0}). A FORFEIT is not matched:
     * player statistics never count one, and team statistics add it explicitly (116 decision 15).
     */
    static final String PLAYED_RESULT = """
            (r.outcome_type in ('WON', 'TIE', 'DRAW')
                     or (r.outcome_type in ('NO_RESULT', 'ABANDONED')
                         and (exists (select 1 from match_innings pinn
                                      where pinn.match_result_id = r.id and pinn.kind = 'REGULAR' and pinn.balls > 0)
                              or exists (select 1 from bowling_entry pbw
                                         join match_innings pbinn on pbinn.id = pbw.match_innings_id
                                         where pbinn.match_result_id = r.id and pbinn.kind = 'REGULAR'
                                           and pbw.balls > 0))))""";
}
