package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.cricketlegend.repository.TeamStatsAggregateRepository.TeamStatsAggregateView;
import com.cricketlegend.repository.TeamStatsFactsRepository.MatchReferenceView;
import com.cricketlegend.repository.TeamStatsFactsRepository.TeamFormView;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The mapping logic of TeamStatsCountersReader and TeamStatsFactsReader: nulls, enum parsing, epoch millis. */
class TeamStatsReadersTest {

    /** A projection whose every getter is null, as a left join with no row would give. */
    private static TeamStatsAggregateView nullRow() {
        return mock(TeamStatsAggregateView.class, inv -> null);
    }

    @Test
    void everyNullCounterReadsAsZeroAndNullOversAsZero() {
        TeamStatsCounters c = TeamStatsCountersReader.toCounters(nullRow());

        assertThat(c.results()).isEqualTo(TeamStatsCounters.EMPTY.results());
        assertThat(c.own().innings()).isZero();
        assertThat(c.own().overs()).isEqualByComparingTo("0");
        assertThat(c.opposition().overs()).isEqualByComparingTo("0");
        assertThat(c.extras().wides()).isEqualTo(new TeamStatsCounters.Component(0, 0));
        assertThat(c.keys().highTotal()).isNull();
        assertThat(c.netRunRate().ownOvers()).isEqualByComparingTo("0");
        assertThat(c.netRunRate().leagueId()).isNull();
        assertThat(c.resultsWithBothInnings()).isZero();
    }

    @Test
    void valuesAreCopiedToTheRightCounters() {
        TeamStatsAggregateView v = nullRow();
        UUID league = UUID.randomUUID();
        when(v.getResults()).thenReturn(9L);
        when(v.getRecWon()).thenReturn(4L);
        when(v.getRecLost()).thenReturn(3L);
        when(v.getRecForfeitsReceived()).thenReturn(1L);
        when(v.getRecForfeitsConceded()).thenReturn(1L);
        when(v.getNoBallBowled()).thenReturn(5L);
        when(v.getOwnRuns()).thenReturn(700L);
        when(v.getOwnOvers()).thenReturn(new BigDecimal("100.5"));
        when(v.getOppWickets()).thenReturn(30L);
        when(v.getExtrasInnings()).thenReturn(6L);
        when(v.getExtras()).thenReturn(80L);
        when(v.getPenaltyInnings()).thenReturn(2L);
        when(v.getPenaltyRuns()).thenReturn(10L);
        when(v.getHighTotalKey()).thenReturn(new BigDecimal("123"));
        when(v.getNrrLeagues()).thenReturn(1L);
        when(v.getNrrLeagueId()).thenReturn(league);
        when(v.getBothInnings()).thenReturn(7L);

        TeamStatsCounters c = TeamStatsCountersReader.toCounters(v);

        assertThat(c.results().results()).isEqualTo(9);
        assertThat(c.results().won()).isEqualTo(4);
        assertThat(c.results().forfeitsReceived()).isEqualTo(1);
        assertThat(c.results().noBallBowled()).isEqualTo(5);
        assertThat(c.own().runs()).isEqualTo(700);
        assertThat(c.own().overs()).isEqualByComparingTo("100.5");
        assertThat(c.opposition().wickets()).isEqualTo(30);
        assertThat(c.extras().total()).isEqualTo(new TeamStatsCounters.Component(6, 80));
        assertThat(c.extras().penalty()).isEqualTo(new TeamStatsCounters.Component(2, 10));
        assertThat(c.keys().highTotal()).isEqualByComparingTo("123");
        assertThat(c.netRunRate().leagueId()).isEqualTo(league);
        assertThat(c.resultsWithBothInnings()).isEqualTo(7);
    }

    @Test
    void emptyKeepsOnlyTheNoBallDisclosure() {
        TeamStatsCounters c = TeamStatsCountersReader.empty(3);

        assertThat(c.results().noBallBowled()).isEqualTo(3);
        assertThat(c.results().results()).isZero();
        assertThat(c.own()).isEqualTo(TeamStatsCounters.EMPTY.own());
    }

    private static TeamFormView form(String outcome, String winning, String side, Long millis, Boolean derby) {
        TeamFormView v = mock(TeamFormView.class, inv -> null);
        when(v.getOutcome()).thenReturn(outcome);
        when(v.getWinningSide()).thenReturn(winning);
        when(v.getSide()).thenReturn(side);
        when(v.getMatchEpochMillis()).thenReturn(millis);
        when(v.getDerby()).thenReturn(derby);
        when(v.getOpponentName()).thenReturn("Rivals");
        return v;
    }

    @Test
    void theFormMapsOutcomeSideEpochMillisAndKeepsTheOrder() {
        var facts = TeamStatsFactsReader.form(List.of(
                form("WON", "HOME", "AWAY", 1_760_000_000_123L, true),
                form("FORFEIT", "AWAY", "AWAY", 1_000L, null),
                form("ABANDONED", null, "HOME", 0L, false)));

        assertThat(facts).hasSize(3);
        assertThat(facts.get(0).result()).isEqualTo("LOST");
        assertThat(facts.get(0).derby()).isTrue();
        assertThat(facts.get(0).forfeit()).isFalse();
        assertThat(facts.get(0).matchDate()).isEqualTo(Instant.ofEpochMilli(1_760_000_000_123L));
        assertThat(facts.get(0).opponentName()).isEqualTo("Rivals");
        assertThat(facts.get(1).result()).isEqualTo("WON");
        assertThat(facts.get(1).forfeit()).isTrue();
        assertThat(facts.get(1).derby()).isFalse(); // a null derby is not a derby
        assertThat(facts.get(2).result()).isEqualTo("NO_RESULT");
    }

    private static MatchReferenceView ref(String kind, UUID match, String opponent) {
        MatchReferenceView v = mock(MatchReferenceView.class, inv -> null);
        when(v.getKind()).thenReturn(kind);
        when(v.getMatchId()).thenReturn(match);
        when(v.getOpponentName()).thenReturn(opponent);
        return v;
    }

    @Test
    void referencesTakeTheFirstRowPerKind() {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        var refs = TeamStatsFactsReader.references(List.of(
                ref(TeamStatsFactsReader.HIGH, first, "A"),
                ref(TeamStatsFactsReader.HIGH, second, "B"),
                ref(TeamStatsFactsReader.VICTORY_RUNS, second, null)));

        assertThat(refs).hasSize(2);
        assertThat(refs.get(TeamStatsFactsReader.HIGH).matchId()).isEqualTo(first);
        assertThat(refs.get(TeamStatsFactsReader.HIGH).opponentName()).isEqualTo("A");
        assertThat(refs.get(TeamStatsFactsReader.VICTORY_RUNS).opponentName()).isNull();
        assertThat(refs.get(TeamStatsFactsReader.LOW)).isNull();
        assertThat(TeamStatsFactsReader.references(List.of())).isEmpty();
    }
}
