package com.cricketlegend.service.support;

import static com.cricketlegend.domain.AvailabilityStatus.AVAILABLE;
import static com.cricketlegend.domain.AvailabilityStatus.UNAVAILABLE;
import static com.cricketlegend.domain.AvailabilityStatus.UNSURE;
import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.MyPollStatusFilter;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The Hub availability history status filter and the one-bucket-per-row summary rule. */
class PollHistoryRulesTest {

    @Test
    void noFilterMatchesEveryRow() {
        assertThat(PollHistoryRules.matches(List.of(), null)).isTrue();
        assertThat(PollHistoryRules.matches(List.of(UNSURE), null)).isTrue();
    }

    @Test
    void notAnsweredMatchesOnlyARowWithNoAnswer() {
        assertThat(PollHistoryRules.matches(List.of(), MyPollStatusFilter.NOT_ANSWERED)).isTrue();
        assertThat(PollHistoryRules.matches(List.of(AVAILABLE), MyPollStatusFilter.NOT_ANSWERED)).isFalse();
    }

    @Test
    void anAnswerStatusMatchesWhenAnyAnswerHasIt() {
        assertThat(PollHistoryRules.matches(List.of(UNAVAILABLE, AVAILABLE), MyPollStatusFilter.AVAILABLE)).isTrue();
        assertThat(PollHistoryRules.matches(List.of(UNAVAILABLE, AVAILABLE), MyPollStatusFilter.UNAVAILABLE)).isTrue();
        assertThat(PollHistoryRules.matches(List.of(UNAVAILABLE, AVAILABLE), MyPollStatusFilter.UNSURE)).isFalse();
        assertThat(PollHistoryRules.matches(List.of(), MyPollStatusFilter.AVAILABLE)).isFalse();
    }

    @Test
    void theSummaryBucketIsAvailableThenUnavailableThenUnsure() {
        assertThat(PollHistoryRules.bucket(List.of())).isEqualTo(MyPollStatusFilter.NOT_ANSWERED);
        assertThat(PollHistoryRules.bucket(List.of(UNSURE, UNAVAILABLE, AVAILABLE))).isEqualTo(MyPollStatusFilter.AVAILABLE);
        assertThat(PollHistoryRules.bucket(List.of(UNSURE, UNAVAILABLE))).isEqualTo(MyPollStatusFilter.UNAVAILABLE);
        assertThat(PollHistoryRules.bucket(List.of(UNSURE, UNSURE))).isEqualTo(MyPollStatusFilter.UNSURE);
    }
}
