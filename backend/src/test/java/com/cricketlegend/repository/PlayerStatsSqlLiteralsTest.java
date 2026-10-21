package com.cricketlegend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultStatus;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;

/**
 * docs/specs/103-player-stats.md: the statistics SQL spells domain enums as string literals (it is native SQL, so it cannot
 * use the enum). This pins every such literal set to the enum rule it encodes, so renaming or adding a {@link
 * DismissalType} fails here instead of silently changing a count. No database needed: it reads the SQL text.
 */
class PlayerStatsSqlLiteralsTest {

    private static final Pattern HOW_OUT_IN = Pattern.compile("how_out\\s+(not\\s+)?in\\s*\\(([^)]*)\\)");
    private static final Pattern HOW_OUT_NE = Pattern.compile("how_out\\s*<>\\s*'([A-Z_]+)'");
    private static final Pattern QUOTED = Pattern.compile("'([A-Z_]+)'");

    private static List<String> allSql() {
        List<String> sql = new ArrayList<>();
        sql.add(PlayerStatsSql.APPEARANCES);
        sql.add(PlayerStatsSql.AGGREGATE);
        sql.add(PlayerStatsSql.HAS_BATTING_CARD);
        sql.add(PlayerStatsSql.HAS_BOWLING_CARD);
        sql.add(PlayerStatsSql.VALID_BALLS);
        sql.add(PlayerStatsSql.COUNTED_BATTING_ROW);
        sql.add(PlayerStatsSql.COUNTED_SPELL);
        sql.add(StatsCountingSql.PUBLISHED);
        sql.add(StatsCountingSql.PLAYED_RESULT);
        sql.add(TeamStatsSql.TEAM_RESULTS);
        sql.add(TeamStatsSql.TEAM_INNINGS);
        sql.add(TeamStatsSql.AGGREGATE);
        sql.add(TeamStatsSql.BASIS);
        sql.add(TeamStatsSql.FILTER_OPTIONS);
        sql.add(TeamStatsSql.USABLE_INNINGS);
        sql.add(TeamStatsSql.HIGH_LOW_RESULT);
        sql.add(TeamStatsSql.COMPLETE_INNINGS);
        sql.add(TeamStatsSql.CLASSIFIABLE_INNINGS);
        sql.add(TeamStatsSql.SUCCESSFUL_CHASE);
        sql.add(TeamStatsSql.NRR_RESULT);
        for (Class<?> repository : List.of(
                PlayerStatsFactsRepository.class,
                PlayerStatsAggregateRepository.class,
                TeamStatsAggregateRepository.class,
                TeamStatsFactsRepository.class)) {
            for (Method method : repository.getDeclaredMethods()) {
                Query query = method.getAnnotation(Query.class);
                if (query != null) {
                    sql.add(query.value());
                }
            }
        }
        return sql;
    }

    private static Set<String> literals(String list) {
        Set<String> found = new LinkedHashSet<>();
        Matcher m = QUOTED.matcher(list);
        while (m.find()) {
            found.add(m.group(1));
        }
        return found;
    }

    @Test
    void theSqlIsFoundAndUsesTheHowOutLiterals() {
        assertThat(allSql()).hasSizeGreaterThanOrEqualTo(8);
        long inLists = allSql().stream()
                .mapToLong(s -> HOW_OUT_IN.matcher(s).results().count())
                .sum();
        assertThat(inLists).isGreaterThanOrEqualTo(4); // proves the pinning below is not vacuous
    }

    @Test
    void everyNotOutListIsExactlyTheNonWicketsThatBatted() {
        Set<String> expected = Arrays.stream(DismissalType.values())
                .filter(type -> !type.isWicket() && type.batted())
                .map(Enum::name)
                .collect(Collectors.toSet());
        assertThat(expected).containsExactlyInAnyOrder("NOT_OUT", "RETIRED_NOT_OUT");
        for (String sql : allSql()) {
            Matcher m = HOW_OUT_IN.matcher(sql);
            while (m.find()) {
                assertThat(literals(m.group(2))).isEqualTo(expected);
            }
        }
    }

    @Test
    void theDidNotBatLiteralIsTheOnlyTypeThatDidNotBat() {
        Set<String> didNotBat = Arrays.stream(DismissalType.values())
                .filter(type -> !type.batted())
                .map(Enum::name)
                .collect(Collectors.toSet());
        assertThat(didNotBat).containsExactly("DID_NOT_BAT");
        Set<String> excluded = new LinkedHashSet<>();
        for (String sql : allSql()) {
            Matcher m = HOW_OUT_NE.matcher(sql);
            while (m.find()) {
                excluded.add(m.group(1));
            }
        }
        // DID_NOT_BAT is excluded from every batting read; RETIRED_OUT only from the duck counts, and it is a wicket
        assertThat(excluded).containsExactlyInAnyOrder("DID_NOT_BAT", "RETIRED_OUT");
        assertThat(DismissalType.valueOf("RETIRED_OUT").isWicket()).isTrue();
    }

    @Test
    void everyQuotedLiteralIsAValueOfTheEnumItIsComparedTo() {
        Pattern outcome = Pattern.compile("outcome(?:_type)?\\s+in\\s*\\(([^)]*)\\)");
        Pattern kind = Pattern.compile("kind\\s*=\\s*'([A-Z_]+)'");
        Pattern side = Pattern.compile("side\\s*=\\s*'([A-Z_]+)'");
        Pattern award = Pattern.compile("award_type\\s*=\\s*'([A-Z_]+)'");
        Pattern status = Pattern.compile("r\\.status\\s*=\\s*'([A-Z_]+)'");
        Set<String> outcomes = names(ResultOutcomeType.values());
        Set<String> kinds = names(InningsKind.values());
        Set<String> sides = names(ResultSide.values());
        Set<String> awards = names(AwardType.values());
        int checked = 0;
        for (String sql : allSql()) {
            Matcher o = outcome.matcher(sql);
            while (o.find()) {
                assertThat(outcomes).containsAll(literals(o.group(1)));
                checked++;
            }
            checked += assertAll(kind, sql, kinds);
            checked += assertAll(side, sql, sides);
            checked += assertAll(award, sql, awards);
            checked += assertAll(status, sql, Set.of(ResultStatus.PUBLISHED.name()));
        }
        assertThat(checked).isGreaterThan(5);
    }

    @Test
    void theAppearancesFragmentGatesOnThePublishedStatusEnum() {
        assertThat(PlayerStatsSql.APPEARANCES).contains("r.status = '" + ResultStatus.PUBLISHED.name() + "'");
    }

    @Test
    void theTeamLiteralsAreValuesOfTheEnumsTheyAreComparedTo() {
        Pattern outcomeEq = Pattern.compile("outcome(?:_type)?\\s*(?:=|<>)\\s*'([A-Z_]+)'");
        Pattern decidedBy = Pattern.compile("decided_by\\s*(?:=|<>)\\s*'([A-Z_]+)'");
        Pattern marginType = Pattern.compile("margin_type\\s*=\\s*'([A-Z_]+)'");
        Pattern battingSide = Pattern.compile("batting_side\\s*=\\s*'([A-Z_]+)'");
        Pattern winningSide = Pattern.compile("winning_side\\s*(?:=|<>)\\s*'([A-Z_]+)'");
        int checked = 0;
        for (String sql : allSql()) {
            checked += assertAll(outcomeEq, sql, names(ResultOutcomeType.values()));
            checked += assertAll(decidedBy, sql, names(ResultDecidedBy.values()));
            checked += assertAll(marginType, sql, names(ResultMarginType.values()));
            checked += assertAll(battingSide, sql, names(ResultSide.values()));
            checked += assertAll(winningSide, sql, names(ResultSide.values()));
        }
        assertThat(checked).isGreaterThan(10);
        assertThat(TeamStatsSql.AGGREGATE).contains("outcome = 'FORFEIT'").contains("decided_by = 'REGULAR'");
        assertThat(TeamStatsSql.TEAM_RESULTS).contains("r.outcome_type = 'FORFEIT'");
    }

    @Test
    void thePublishedAndPlayedPredicatesAreSplicedFromTheSharedHolder() {
        assertThat(StatsCountingSql.PUBLISHED).isEqualTo("r.status = '" + ResultStatus.PUBLISHED.name() + "'");
        assertThat(PlayerStatsSql.APPEARANCES).contains(StatsCountingSql.PUBLISHED);
        assertThat(TeamStatsSql.TEAM_RESULTS).contains(StatsCountingSql.PUBLISHED).contains(StatsCountingSql.PLAYED_RESULT);
    }

    private static int assertAll(Pattern pattern, String sql, Set<String> allowed) {
        int count = 0;
        Matcher m = pattern.matcher(sql);
        while (m.find()) {
            assertThat(allowed).contains(m.group(1));
            count++;
        }
        return count;
    }

    private static Set<String> names(Enum<?>[] values) {
        return Arrays.stream(values).map(Enum::name).collect(Collectors.toSet());
    }
}
