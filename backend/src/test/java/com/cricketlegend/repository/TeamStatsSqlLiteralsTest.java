package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/116-team-stats.md: the team SQL spells domain enums as string literals; this pins every one to its enum and
 * pins the named classification predicates (which the calculator cannot test, they run in SQL) as text. No database.
 */
class TeamStatsSqlLiteralsTest {

    private static final List<String> TEAM_SQL = List.of(
            TeamStatsSql.TEAM_RESULTS, TeamStatsSql.TEAM_INNINGS, TeamStatsSql.AGGREGATE, TeamStatsSql.BASIS,
            TeamStatsSql.FILTER_OPTIONS, TeamStatsSql.TEAM_FORM, TeamStatsSql.MATCH_REFERENCES,
            TeamStatsSql.USABLE_INNINGS, TeamStatsSql.HIGH_LOW_RESULT, TeamStatsSql.COMPLETE_INNINGS,
            TeamStatsSql.CLASSIFIABLE_INNINGS, TeamStatsSql.SUCCESSFUL_CHASE, TeamStatsSql.NRR_RESULT,
            TeamStatsSql.VICTORY_BY_RUNS_RESULT, TeamStatsSql.VICTORY_BY_WICKETS_RESULT);

    private static Set<String> names(Enum<?>[] values) {
        return Arrays.stream(values).map(Enum::name).collect(Collectors.toSet());
    }

    private static int check(Pattern pattern, Set<String> allowed) {
        int count = 0;
        for (String sql : TEAM_SQL) {
            Matcher m = pattern.matcher(sql);
            while (m.find()) {
                assertThat(allowed).as(m.group()).contains(m.group(1));
                count++;
            }
        }
        return count;
    }

    private static String flat(String sql) {
        return sql.replaceAll("\\s+", " ").trim();
    }

    @Test
    void everyEnumLiteralInTheTeamSqlIsAValueOfItsEnum() {
        int n = 0;
        n += check(Pattern.compile("outcome(?:_type)?\\s*(?:=|<>)\\s*'([A-Z_]+)'"), names(ResultOutcomeType.values()));
        n += check(Pattern.compile("decided_by\\s*(?:=|<>)\\s*'([A-Z_]+)'"), names(ResultDecidedBy.values()));
        n += check(Pattern.compile("margin_type\\s*=\\s*'([A-Z_]+)'"), names(ResultMarginType.values()));
        n += check(Pattern.compile("batting_side\\s*=\\s*'([A-Z_]+)'"), names(ResultSide.values()));
        n += check(Pattern.compile("winning_side\\s*(?:=|<>)\\s*'([A-Z_]+)'"), names(ResultSide.values()));
        n += check(Pattern.compile("\\bkind\\s*=\\s*'([A-Z_]+)'"), names(InningsKind.values()));
        n += check(Pattern.compile("r\\.status\\s*=\\s*'([A-Z_]+)'"), Set.of(ResultStatus.PUBLISHED.name()));
        n += check(Pattern.compile("side\\s*=\\s*'([A-Z_]+)'"), names(ResultSide.values()));
        assertThat(n).isGreaterThan(15);
    }

    @Test
    void everyQuotedNameInAnOutcomeInListIsAnOutcome() {
        Pattern in = Pattern.compile("outcome(?:_type)?\\s+in\\s*\\(([^)]*)\\)");
        int lists = 0;
        for (String sql : TEAM_SQL) {
            Matcher m = in.matcher(sql);
            while (m.find()) {
                Matcher q = Pattern.compile("'([A-Z_]+)'").matcher(m.group(1));
                while (q.find()) {
                    assertThat(names(ResultOutcomeType.values())).contains(q.group(1));
                }
                lists++;
            }
        }
        assertThat(lists).isGreaterThan(2);
    }

    @Test
    void theForfeitOutcomeAndItsSidesExist() {
        assertThat(names(ResultOutcomeType.values())).contains("FORFEIT", "WON", "TIE", "DRAW", "NO_RESULT", "ABANDONED");
        assertThat(TeamStatsSql.TEAM_RESULTS).contains("r.outcome_type = 'FORFEIT'");
        assertThat(TeamStatsSql.TEAM_INNINGS).contains("tr.outcome <> 'FORFEIT'");
        assertThat(TeamStatsSql.AGGREGATE).contains("tr.outcome = 'FORFEIT' and tr.winning_side = tr.side");
        assertThat(TeamStatsSql.AGGREGATE).contains("tr.outcome = 'FORFEIT' and tr.winning_side <> tr.side");
        assertThat(names(ResultDecidedBy.values())).contains("REGULAR", "DLS");
        assertThat(names(ResultMarginType.values())).contains("RUNS", "WICKETS");
    }

    @Test
    void thePlayedPredicateIsTheUnchanged103PredicateAndPlayerStatsSplicesIt() {
        String predicate103 = "(r.outcome_type in ('WON', 'TIE', 'DRAW') or (r.outcome_type in ('NO_RESULT', 'ABANDONED')"
                + " and (exists (select 1 from match_innings pinn where pinn.match_result_id = r.id and pinn.kind = 'REGULAR'"
                + " and pinn.balls > 0) or exists (select 1 from bowling_entry pbw join match_innings pbinn on"
                + " pbinn.id = pbw.match_innings_id where pbinn.match_result_id = r.id and pbinn.kind = 'REGULAR'"
                + " and pbw.balls > 0))))";

        assertThat(flat(StatsCountingSql.PLAYED_RESULT)).isEqualTo(predicate103);
        assertThat(flat(PlayerStatsSql.APPEARANCES)).contains(predicate103);
        assertThat(flat(TeamStatsSql.TEAM_RESULTS)).contains(predicate103).contains("or r.outcome_type = 'FORFEIT'");
        assertThat(StatsCountingSql.PUBLISHED).isEqualTo("r.status = '" + ResultStatus.PUBLISHED.name() + "'");
        assertThat(PlayerStatsSql.APPEARANCES).contains(StatsCountingSql.PUBLISHED);
        assertThat(TeamStatsSql.TEAM_RESULTS).contains(StatsCountingSql.PUBLISHED);
    }

    @Test
    void superOverInningsAreNeverRead() {
        assertThat(TeamStatsSql.TEAM_INNINGS).contains("i.kind = 'REGULAR'");
    }

    @Test
    void completeInningsIsAllOutOrFullQuotaWithTheQuotaKnownAndNoDlsException() {
        String complete = flat(TeamStatsSql.COMPLETE_INNINGS);

        assertThat(complete).contains("ti.all_out or");
        assertThat(complete).contains("ti.decided_by <> 'DLS'");
        assertThat(complete).contains("ti.scheduled_balls is not null");
        // a chase that finishes exactly on the last ball is complete: >=, not >
        assertThat(complete).contains("ti.balls >= ti.scheduled_balls").doesNotContain("ti.balls > ti.scheduled_balls");
        assertThat(flat(TeamStatsSql.CLASSIFIABLE_INNINGS)).isEqualTo("(ti.all_out or ti.scheduled_balls is not null)");
    }

    @Test
    void highsAndLowsComeOnlyFromWonTiedOrDrawnResults() {
        assertThat(flat(TeamStatsSql.HIGH_LOW_RESULT)).isEqualTo("ti.outcome in ('WON', 'TIE', 'DRAW')");
    }

    @Test
    void aSuccessfulChaseIsARegularWinBattingSecondWithBothInningsUsable() {
        String chase = flat(TeamStatsSql.SUCCESSFUL_CHASE);

        assertThat(chase).contains("ti.outcome = 'WON'").contains("ti.winning_side = ti.side")
                .contains("ti.decided_by = 'REGULAR'").contains("ti.inn_count = 2")
                .contains("ti.sequence = ti.last_seq").contains("pv.sequence < ti.sequence")
                .contains("ti.usable and pv.usable").doesNotContain("TIE");
        assertThat(TeamStatsSql.CHASE_KEY).contains("pv.runs + 1"); // target = opposition runs + 1
    }

    @Test
    void victoriesAreRegularWinsWithAStoredMarginOfTheRightType() {
        String runs = flat(TeamStatsSql.VICTORY_BY_RUNS_RESULT);
        String wickets = flat(TeamStatsSql.VICTORY_BY_WICKETS_RESULT);

        for (String s : List.of(runs, wickets)) {
            assertThat(s).contains("tr.outcome = 'WON'").contains("tr.decided_by = 'REGULAR'")
                    .contains("tr.margin_value is not null").contains("tr.winning_side = tr.side");
        }
        assertThat(runs).contains("tr.margin_type = 'RUNS'");
        assertThat(wickets).contains("tr.margin_type = 'WICKETS'");
    }

    @Test
    void netRunRateEntersWonAndTieOnlyInALeagueWithExactlyOneInningsEachWay() {
        String nrr = flat(TeamStatsSql.NRR_RESULT);

        assertThat(nrr).contains("rs.outcome in ('WON', 'TIE')").contains("rs.decided_by <> 'DLS'")
                .contains("rs.league_id is not null").contains("rs.n_own = 1").contains("rs.n_opp = 1")
                .contains("rs.all_usable").contains("rs.quota_known").doesNotContain("DRAW").doesNotContain("NO_RESULT");
    }

    @Test
    void anAllOutInningsIsCountedAtTheQuotaForNetRunRateButAtActualBallsForThePlainRunRate() {
        String sql = flat(TeamStatsSql.AGGREGATE);

        assertThat(sql).contains("case when ti.all_out then ti.scheduled_balls else ti.balls end");
        assertThat(sql).contains("sum(cast(ti.balls as numeric) / ti.bpo) filter (where ti.own and ti.usable and ti.balls > 0)");
    }
}
