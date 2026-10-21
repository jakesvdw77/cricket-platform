package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.repository.PlayerStatsFactsRepository.MatchAwardView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.MatchBattingView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.MatchBowlingView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.MatchFieldingView;
import com.cricketlegend.repository.PlayerStatsFactsRepository.MatchHeaderView;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The null handling and enum parsing of the repository-row mapping for docs/specs/115. */
class PlayerMatchFactsReaderTest {

    @Test
    void headerParsesEnumsAndEpochAndTreatsNullFlagsAsFalse() {
        MatchHeaderView v = mock(MatchHeaderView.class);
        when(v.getMatchEpochMillis()).thenReturn(1_700_000_000_000L);
        when(v.getBallsPerOver()).thenReturn(6);
        when(v.getOutcome()).thenReturn("WON");
        when(v.getWinningSide()).thenReturn("AWAY");
        var h = PlayerMatchFactsReader.toHeader(v);
        assertThat(h.matchDate()).isEqualTo(Instant.ofEpochMilli(1_700_000_000_000L));
        assertThat(h.outcome()).isEqualTo(ResultOutcomeType.WON);
        assertThat(h.winningSide()).isEqualTo(ResultSide.AWAY);
        assertThat(h.derby()).isFalse();
        assertThat(h.onHome()).isFalse();
        assertThat(h.onAway()).isFalse();
        assertThat(h.hasBattingCard()).isFalse();
        assertThat(h.hasBowlingCard()).isFalse();
    }

    @Test
    void headerKeepsATrueFlagAndANullWinningSide() {
        MatchHeaderView v = mock(MatchHeaderView.class);
        when(v.getMatchEpochMillis()).thenReturn(0L);
        when(v.getOutcome()).thenReturn("DRAW");
        when(v.getDerby()).thenReturn(true);
        when(v.getOnHome()).thenReturn(true);
        when(v.getHasBowlingCard()).thenReturn(true);
        var h = PlayerMatchFactsReader.toHeader(v);
        assertThat(h.winningSide()).isNull();
        assertThat(h.derby()).isTrue();
        assertThat(h.onHome()).isTrue();
        assertThat(h.hasBowlingCard()).isTrue();
    }

    @Test
    void battingParsesTheDismissalAndKeepsNullOptionals() {
        MatchBattingView v = mock(MatchBattingView.class);
        UUID id = UUID.randomUUID();
        when(v.getResultId()).thenReturn(id);
        when(v.getRuns()).thenReturn(12);
        when(v.getHowOut()).thenReturn("RETIRED_NOT_OUT");
        when(v.getBalls()).thenReturn(null); // a Mockito mock answers 0 for Integer unless told otherwise
        when(v.getFours()).thenReturn(null);
        when(v.getSixes()).thenReturn(null);
        var b = PlayerMatchFactsReader.toBatting(v);
        assertThat(b.resultId()).isEqualTo(id);
        assertThat(b.howOut()).isEqualTo(DismissalType.RETIRED_NOT_OUT);
        assertThat(b.balls()).isNull();
        assertThat(b.fours()).isNull();
        assertThat(b.sixes()).isNull();
    }

    @Test
    void bowlingNullCountsBecomeZeroButOptionalColumnsStayNull() {
        MatchBowlingView v = mock(MatchBowlingView.class);
        when(v.getWickets()).thenReturn(2);
        for (var unset : new Integer[] {null}) {
            when(v.getBalls()).thenReturn(unset);
            when(v.getMaidens()).thenReturn(unset);
            when(v.getRuns()).thenReturn(unset);
            when(v.getDots()).thenReturn(unset);
            when(v.getWides()).thenReturn(unset);
            when(v.getNoBalls()).thenReturn(unset);
        }
        var b = PlayerMatchFactsReader.toBowling(v);
        assertThat(b.balls()).isZero();
        assertThat(b.maidens()).isZero();
        assertThat(b.runs()).isZero();
        assertThat(b.wickets()).isEqualTo(2);
        assertThat(b.dots()).isNull();
        assertThat(b.wides()).isNull();
        assertThat(b.noBalls()).isNull();
    }

    @Test
    void fieldingAndAwardNullCountsBecomeZero() {
        MatchFieldingView fv = mock(MatchFieldingView.class);
        when(fv.getCatches()).thenReturn(null);
        when(fv.getStumpings()).thenReturn(null);
        when(fv.getRunOuts()).thenReturn(null);
        var f = PlayerMatchFactsReader.toFielding(fv);
        assertThat(f.catches()).isZero();
        assertThat(f.stumpings()).isZero();
        assertThat(f.runOuts()).isZero();
        MatchAwardView av = mock(MatchAwardView.class);
        when(av.getPlayerOfMatch()).thenReturn(null);
        when(av.getTeamPlayerOfMatch()).thenReturn(2L);
        var a = PlayerMatchFactsReader.toAward(av);
        assertThat(a.playerOfTheMatch()).isZero();
        assertThat(a.teamPlayerOfTheMatch()).isEqualTo(2L);
    }
}
