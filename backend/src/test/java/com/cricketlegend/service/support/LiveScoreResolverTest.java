package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.LiveScoreKind;
import com.cricketlegend.domain.MatchPhase;
import com.cricketlegend.dto.LiveScoreSource;
import org.junit.jupiter.api.Test;

/** docs/specs/135, the LiveScore seam: EXTERNAL from an https scoring link, null otherwise and once recent. */
class LiveScoreResolverTest {

    @Test
    void anHttpsLinkIsAnExternalSourceWithItsHost() {
        LiveScoreSource s = LiveScoreResolver.resolve("https://Scores.Example.com/m/1", MatchPhase.LIVE);
        assertThat(s.kind()).isEqualTo(LiveScoreKind.EXTERNAL);
        assertThat(s.url()).isEqualTo("https://Scores.Example.com/m/1");
        assertThat(s.host()).isEqualTo("scores.example.com");
        assertThat(LiveScoreResolver.resolve("https://scores.example.com/m/1", MatchPhase.UPCOMING)).isNotNull();
    }

    @Test
    void anythingButHttpsIsNull() {
        for (String link : new String[] {"http://scores.example.com", "javascript:alert(1)", "data:text/html,x", "", null, "x y"}) {
            assertThat(LiveScoreResolver.resolve(link, MatchPhase.LIVE)).as(String.valueOf(link)).isNull();
        }
    }

    @Test
    void aRecentMatchHasNoLiveScore() {
        assertThat(LiveScoreResolver.resolve("https://scores.example.com/m/1", MatchPhase.RECENT)).isNull();
    }

    @Test
    void theLinkKeepsAFinishedMatchsScorecardWhateverThePhase() {
        LiveScoreSource s = LiveScoreResolver.link("https://scores.example.com/m/1");
        assertThat(s.kind()).isEqualTo(LiveScoreKind.EXTERNAL);
        assertThat(s.host()).isEqualTo("scores.example.com");
        for (String link : new String[] {"http://scores.example.com", "javascript:alert(1)", "", null}) {
            assertThat(LiveScoreResolver.link(link)).as(String.valueOf(link)).isNull();
        }
    }
}
