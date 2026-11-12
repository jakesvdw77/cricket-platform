package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.dto.MyStatsInningsPageDto;
import com.cricketlegend.dto.PlayerMatchRowDto;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBatting;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBattingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBowling;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBowlingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchFielding;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchFieldingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchInnings;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchResult;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchSpell;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchTeam;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.service.support.StatsDrillFilter.BattingSubject;
import com.cricketlegend.service.support.StatsDrillFilter.BowlingSubject;
import com.cricketlegend.service.support.StatsDrillFilter.Filter;
import com.cricketlegend.service.support.StatsDrillFilter.FieldingSubject;
import com.cricketlegend.service.support.StatsDrillFilter.Kind;
import com.cricketlegend.service.support.StatsDrillFilter.MatchSubject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/147 Test Plan: the enumerated drill tokens, what each keeps, the 400 path of an unknown or inapplicable
 * token, and the paging of {@link MyStatsDrill}. Pure.
 */
class StatsDrillFilterTest {

    private static BattingSubject bat(int seq, Integer runs, boolean notOut, DismissalType out) {
        return new BattingSubject(seq, runs, notOut, out);
    }

    // ---- parsing ----

    @Test
    void everyKindParsesCaseInsensitivelyWithSurroundingSpaces() {
        for (Kind k : Kind.values()) {
            assertThat(StatsDrillFilter.parseKind(k.name().toLowerCase())).isEqualTo(k);
            assertThat(StatsDrillFilter.parseKind("  " + k.name() + " ")).isEqualTo(k);
            assertThat(k.title()).isNotBlank();
        }
    }

    @Test
    void anUnknownOrBlankKindIsAValidationError() {
        for (String bad : new String[] {null, "", "  ", "WICKETS", "batting innings"}) {
            assertThatThrownBy(() -> StatsDrillFilter.parseKind(bad)).isInstanceOf(ValidationException.class);
        }
    }

    @Test
    void everyFilterParsesForEachKindItAppliesToAndIsRefusedForTheOthers() {
        int accepted = 0;
        int refused = 0;
        for (Filter f : Filter.values()) {
            assertThat(f.label()).isNotBlank();
            for (Kind k : Kind.values()) {
                if (f.appliesTo(k)) {
                    assertThat(StatsDrillFilter.parseFilter(k, f.name().toLowerCase())).isEqualTo(f);
                    accepted++;
                } else {
                    assertThatThrownBy(() -> StatsDrillFilter.parseFilter(k, f.name())).isInstanceOf(ValidationException.class);
                    refused++;
                }
            }
        }
        assertThat(accepted).isEqualTo(Filter.values().length + 1); // SCORED_30_PLUS applies to two kinds
        assertThat(refused).isEqualTo(Filter.values().length * Kind.values().length - accepted);
    }

    @Test
    void aBlankFilterIsNoFilterAndAnUnknownOneIsAValidationError() {
        assertThat(StatsDrillFilter.parseFilter(Kind.BATTING, null)).isNull();
        assertThat(StatsDrillFilter.parseFilter(Kind.BATTING, "  ")).isNull();
        assertThatThrownBy(() -> StatsDrillFilter.parseFilter(Kind.BATTING, "BAND_1000")).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> StatsDrillFilter.parseFilter(Kind.BATTING, "'; drop table")).isInstanceOf(ValidationException.class);
    }

    @Test
    void everyDismissalTypeHasADrillTokenThatIsAFilterOrNotOut() {
        for (DismissalType type : DismissalType.values()) {
            if (type == DismissalType.DID_NOT_BAT) {
                continue; // never a batted innings
            }
            String token = StatsDrillFilter.dismissalToken(type);
            assertThat(Filter.valueOf(token)).as(type.name()).isNotNull();
        }
        assertThat(StatsDrillFilter.dismissalToken(DismissalType.NOT_OUT)).isEqualTo("NOT_OUT");
        assertThat(StatsDrillFilter.dismissalToken(DismissalType.RETIRED_NOT_OUT)).isEqualTo("NOT_OUT");
        assertThat(StatsDrillFilter.dismissalToken(DismissalType.CAUGHT_AND_BOWLED)).isEqualTo("OUT_CAUGHT_AND_BOWLED");
    }

    // ---- batting ----

    @Test
    void scoreBandsKeepTheirEdgesAndDropAnInningsWithNoStoredScore() {
        assertThat(StatsDrillFilter.keeps(Filter.BAND_0_9, bat(1, 0, false, DismissalType.BOWLED))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.BAND_0_9, bat(1, 9, false, DismissalType.BOWLED))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.BAND_0_9, bat(1, 10, false, DismissalType.BOWLED))).isFalse();
        assertThat(StatsDrillFilter.keeps(Filter.BAND_10_29, bat(1, 10, false, DismissalType.BOWLED))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.BAND_10_29, bat(1, 29, false, DismissalType.BOWLED))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.BAND_30_49, bat(1, 30, false, DismissalType.BOWLED))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.BAND_30_49, bat(1, 49, false, DismissalType.BOWLED))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.BAND_50_PLUS, bat(1, 49, false, DismissalType.BOWLED))).isFalse();
        assertThat(StatsDrillFilter.keeps(Filter.BAND_50_PLUS, bat(1, 50, true, DismissalType.NOT_OUT))).isTrue();
        for (Filter band : List.of(Filter.BAND_0_9, Filter.BAND_10_29, Filter.BAND_30_49, Filter.BAND_50_PLUS, Filter.SCORED_30_PLUS)) {
            assertThat(StatsDrillFilter.keeps(band, bat(1, null, false, DismissalType.BOWLED))).as(band.name()).isFalse();
        }
    }

    @Test
    void everyScoreInExactlyOneBand() {
        for (int runs = 0; runs <= 150; runs++) {
            int in = 0;
            for (Filter band : List.of(Filter.BAND_0_9, Filter.BAND_10_29, Filter.BAND_30_49, Filter.BAND_50_PLUS)) {
                if (StatsDrillFilter.keeps(band, bat(1, runs, false, DismissalType.BOWLED))) {
                    in++;
                }
            }
            assertThat(in).as("runs " + runs).isEqualTo(1);
        }
    }

    @Test
    void inningsNumberNotOutAndThirtyPlusFilters() {
        assertThat(StatsDrillFilter.keeps(Filter.FIRST_INNINGS, bat(1, 5, false, DismissalType.BOWLED))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.FIRST_INNINGS, bat(2, 5, false, DismissalType.BOWLED))).isFalse();
        assertThat(StatsDrillFilter.keeps(Filter.SECOND_INNINGS, bat(2, 5, false, DismissalType.BOWLED))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.SECOND_INNINGS, bat(3, 5, false, DismissalType.BOWLED))).isFalse();
        assertThat(StatsDrillFilter.keeps(Filter.NOT_OUT, bat(1, 5, true, DismissalType.NOT_OUT))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.NOT_OUT, bat(1, 5, false, DismissalType.BOWLED))).isFalse();
        assertThat(StatsDrillFilter.keeps(Filter.SCORED_30_PLUS, bat(1, 30, false, DismissalType.BOWLED))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.SCORED_30_PLUS, bat(1, 29, false, DismissalType.BOWLED))).isFalse();
    }

    @Test
    void everyDismissalTokenKeepsOnlyItsOwnDismissalType() {
        for (DismissalType type : DismissalType.values()) {
            if (type == DismissalType.NOT_OUT || type == DismissalType.RETIRED_NOT_OUT || type == DismissalType.DID_NOT_BAT) {
                continue;
            }
            Filter own = Filter.valueOf("OUT_" + type.name());
            for (Filter f : Filter.values()) {
                if (!f.name().startsWith("OUT_")) {
                    continue;
                }
                assertThat(StatsDrillFilter.keeps(f, bat(1, 5, false, type))).as(f + " vs " + type).isEqualTo(f == own);
            }
        }
        assertThat(StatsDrillFilter.keeps(Filter.OUT_BOWLED, bat(1, 5, false, null))).isFalse();
        assertThat(StatsDrillFilter.keeps(Filter.OUT_BOWLED, bat(1, 5, true, DismissalType.NOT_OUT))).isFalse();
    }

    @Test
    void noFilterKeepsEverything() {
        assertThat(StatsDrillFilter.keeps((Filter) null, bat(1, null, true, null))).isTrue();
        assertThat(StatsDrillFilter.keeps((Filter) null, new BowlingSubject(0))).isTrue();
        assertThat(StatsDrillFilter.keeps((Filter) null, new MatchSubject(null, false))).isTrue();
    }

    // ---- bowling, fielding, matches ----

    @Test
    void bowlingFilters() {
        assertThat(StatsDrillFilter.keeps(Filter.WICKETS, new BowlingSubject(0))).isFalse();
        assertThat(StatsDrillFilter.keeps(Filter.WICKETS, new BowlingSubject(1))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.THREE_WICKETS_PLUS, new BowlingSubject(2))).isFalse();
        assertThat(StatsDrillFilter.keeps(Filter.THREE_WICKETS_PLUS, new BowlingSubject(3))).isTrue();
    }

    @Test
    void fieldingFiltersAndTheUnfilteredListKeepsOnlyMatchesWithACredit() {
        FieldingSubject catchOnly = new FieldingSubject(1, 0, 0);
        FieldingSubject none = new FieldingSubject(0, 0, 0);
        assertThat(StatsDrillFilter.keeps((Filter) null, catchOnly)).isTrue();
        assertThat(StatsDrillFilter.keeps((Filter) null, none)).isFalse();
        assertThat(StatsDrillFilter.keeps(Filter.CATCHES, catchOnly)).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.STUMPINGS, catchOnly)).isFalse();
        assertThat(StatsDrillFilter.keeps(Filter.STUMPINGS, new FieldingSubject(0, 2, 0))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.RUN_OUTS, new FieldingSubject(0, 0, 1))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.RUN_OUTS, catchOnly)).isFalse();
    }

    @Test
    void matchFiltersUnder30NeedsACapturedBattingCard() {
        assertThat(StatsDrillFilter.keeps(Filter.SCORED_30_PLUS, new MatchSubject(30, true))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.SCORED_30_PLUS, new MatchSubject(29, true))).isFalse();
        assertThat(StatsDrillFilter.keeps(Filter.SCORED_30_PLUS, new MatchSubject(null, true))).isFalse();
        assertThat(StatsDrillFilter.keeps(Filter.UNDER_30, new MatchSubject(29, true))).isTrue();
        assertThat(StatsDrillFilter.keeps(Filter.UNDER_30, new MatchSubject(null, true))).isTrue(); // batted, no stored score
        assertThat(StatsDrillFilter.keeps(Filter.UNDER_30, new MatchSubject(null, false))).isFalse(); // no card at all
        assertThat(StatsDrillFilter.keeps(Filter.UNDER_30, new MatchSubject(30, true))).isFalse();
    }

    // ---- MyStatsDrill paging ----

    private static PlayerMatchRowDto batted(int n, int runs) {
        Instant when = Instant.parse("2031-06-01T10:00:00Z").plusSeconds(n * 86400L);
        PlayerMatchInnings innings = new PlayerMatchInnings(runs, 20, false, DismissalType.BOWLED, 1, 0);
        return new PlayerMatchRowDto(new UUID(0, n), new UUID(1, n), when, List.of(new PlayerMatchTeam("HOME", UUID.randomUUID(), "Hawks")),
                "Opp", false, null, null, "FRIENDLY", PlayerMatchResult.WON, 6, true, false,
                new PlayerMatchBatting(PlayerMatchBattingStatus.BATTED, List.of(innings), 1, (long) runs, 20L, 1L, 0L),
                new PlayerMatchBowling(PlayerMatchBowlingStatus.NO_CARD, null, null, null, null, null, null),
                new PlayerMatchFielding(PlayerMatchFieldingStatus.NO_CARD, null, null, null),
                new PlayerMatchRowDto.PlayerMatchAwards(0, 0));
    }

    private static HeldPlayerHistory history(int matches, boolean truncated) {
        List<PlayerMatchRowDto> rows = new ArrayList<>();
        List<PlayerStatsCalculator.RawBattingDetail> raw = new ArrayList<>();
        for (int i = 1; i <= matches; i++) {
            PlayerMatchRowDto r = batted(i, i);
            rows.add(r);
            raw.add(new PlayerStatsCalculator.RawBattingDetail(r.resultId(), 1, 1, i, 20, 1, 0, DismissalType.BOWLED, null, null,
                    false, false, null, null));
        }
        return new HeldPlayerHistory(PlayerStatsTestData.counters().build(), truncated, rows, raw, List.of(), List.of(), null, List.of());
    }

    @Test
    void theDrillIsNewestFirstPagedWithTheTotalAndHasMore() {
        HeldPlayerHistory h = history(25, false);
        MyStatsInningsPageDto first = MyStatsDrill.page(Kind.BATTING, null, h, null, null);
        assertThat(first.rows()).hasSize(MyStatsDrill.DEFAULT_SIZE);
        assertThat(first.rows().get(0).batting().runs()).isEqualTo(25); // newest first
        assertThat(first.page().totalElements()).isEqualTo(25);
        assertThat(first.page().hasMore()).isTrue();
        assertThat(first.kind()).isEqualTo("BATTING");
        assertThat(first.filter()).isNull();

        MyStatsInningsPageDto second = MyStatsDrill.page(Kind.BATTING, null, h, 1, null);
        assertThat(second.rows()).hasSize(5);
        assertThat(second.page().hasMore()).isFalse();
        assertThat(MyStatsDrill.page(Kind.BATTING, null, h, 9, 20).rows()).isEmpty();
    }

    @Test
    void aFilteredDrillCountsOnlyTheRowsItKeepsAndEchoesTheTruncatedFlag() {
        HeldPlayerHistory h = history(60, true);
        MyStatsInningsPageDto p = MyStatsDrill.page(Kind.BATTING, Filter.BAND_50_PLUS, h, 0, 100);
        assertThat(p.page().totalElements()).isEqualTo(11); // 50 to 60
        assertThat(p.rows()).allSatisfy(r -> assertThat(r.batting().runs()).isGreaterThanOrEqualTo(50));
        assertThat(p.truncated()).isTrue();
        assertThat(p.filter()).isEqualTo("BAND_50_PLUS");
        assertThat(p.filterLabel()).isEqualTo(Filter.BAND_50_PLUS.label());
    }

    @Test
    void anEmptyHistoryGivesAnEmptyPageForEveryKind() {
        HeldPlayerHistory h = history(0, false);
        for (Kind k : Kind.values()) {
            MyStatsInningsPageDto p = MyStatsDrill.page(k, null, h, null, null);
            assertThat(p.rows()).isEmpty();
            assertThat(p.page().totalElements()).isZero();
            assertThat(p.page().hasMore()).isFalse();
        }
    }

    @Test
    void badPagingIsAValidationError() {
        assertThatThrownBy(() -> MyStatsDrill.checkPaging(-1, null)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> MyStatsDrill.checkPaging(0, 0)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> MyStatsDrill.checkPaging(0, MyStatsDrill.MAX_SIZE + 1)).isInstanceOf(ValidationException.class);
        MyStatsDrill.checkPaging(0, MyStatsDrill.MAX_SIZE);
        MyStatsDrill.checkPaging(null, null);
    }
}
