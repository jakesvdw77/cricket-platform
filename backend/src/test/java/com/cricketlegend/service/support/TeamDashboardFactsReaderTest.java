package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.cricketlegend.repository.TeamStatsFactsRepository.TeamDashboardResultView;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The reader copies a query row into the builder's plain input: values pass through and absent counts become 0. */
class TeamDashboardFactsReaderTest {

    @Test
    void valuesPassThroughAndNullFiguresStayNull() {
        TeamDashboardResultView v = mock(TeamDashboardResultView.class);
        UUID result = UUID.randomUUID();
        when(v.getResultId()).thenReturn(result);
        when(v.getMatchEpochMillis()).thenReturn(Instant.parse("2026-03-14T09:30:00Z").toEpochMilli());
        when(v.getDerby()).thenReturn(null);
        when(v.getOutcome()).thenReturn("WON");
        when(v.getSide()).thenReturn("HOME");
        when(v.getOwnRuns()).thenReturn(120L);
        when(v.getOwnOvers()).thenReturn(new BigDecimal("20"));
        when(v.getBowlDots()).thenReturn(0L);
        when(v.getNrrUsable()).thenReturn(true);
        when(v.getExtras()).thenReturn(null);
        when(v.getWides()).thenReturn(null);

        TeamDashboardSeriesBuilder.ResultFact fact = TeamDashboardFactsReader.toFact(v);

        assertThat(fact.resultId()).isEqualTo(result);
        assertThat(fact.matchDate()).isEqualTo(Instant.parse("2026-03-14T09:30:00Z"));
        assertThat(fact.derby()).isFalse();
        assertThat(fact.outcome()).isEqualTo("WON");
        assertThat(fact.ownRuns()).isEqualTo(120L);
        assertThat(fact.bowlDots()).isZero(); // a recorded 0 stays 0
        assertThat(fact.extras()).isNull(); // an unrecorded figure stays null, never 0
        assertThat(fact.wides()).isNull();
        assertThat(fact.nrrUsable()).isTrue();
    }

    @Test
    void absentCountersBecomeZeroButNeverTurnAFigureIntoZero() {
        TeamDashboardResultView v = mock(TeamDashboardResultView.class);
        when(v.getMatchEpochMillis()).thenReturn(0L);
        when(v.getOppInnings()).thenReturn(null);
        when(v.getOwnUsable()).thenReturn(null);
        when(v.getOppUsable()).thenReturn(null);
        when(v.getBowlRows()).thenReturn(null);
        when(v.getBowlDotsRows()).thenReturn(null);
        when(v.getNrrOwnRuns()).thenReturn(null);
        when(v.getOwnRuns()).thenReturn(null);
        when(v.getBowlBalls()).thenReturn(null);
        when(v.getNrrUsable()).thenReturn(null);

        TeamDashboardSeriesBuilder.ResultFact fact = TeamDashboardFactsReader.toFact(v);

        assertThat(fact.oppInnings()).isZero();
        assertThat(fact.ownUsable()).isZero();
        assertThat(fact.oppUsable()).isZero();
        assertThat(fact.bowlRows()).isZero();
        assertThat(fact.bowlDotsRows()).isZero();
        assertThat(fact.nrrOwnRuns()).isZero();
        assertThat(fact.nrrUsable()).isFalse();
        assertThat(fact.ownRuns()).isNull();
        assertThat(fact.bowlBalls()).isNull();
    }
}
