package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.MatchResultStatus;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.MatchSquadMemberRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MatchEmptinessTest {

    private final ResultStatusResolver resolver = mock(ResultStatusResolver.class);
    private final MatchAvailabilityPollRepository polls = mock(MatchAvailabilityPollRepository.class);
    private final MatchEmptiness emptiness = new MatchEmptiness(
            resolver, polls, mock(MatchSquadMemberRepository.class), mock(MatchSideRepository.class),
            mock(SectionAvailabilityWindowMatchRepository.class));

    @Test
    void emptyAmongWithSuppliedStatusesNeverQueriesResultsAgain() {
        UUID withDraft = UUID.randomUUID();
        UUID withPoll = UUID.randomUUID();
        UUID bare = UUID.randomUUID();
        List<UUID> ids = List.of(withDraft, withPoll, bare);
        when(polls.findMatchIdsWithPollByMatchIdIn(any())).thenReturn(List.of(withPoll));

        var empty = emptiness.emptyAmong(ids, Map.of(withDraft, MatchResultStatus.DRAFT));

        assertThat(empty).containsExactly(bare);
        verify(resolver, never()).statusesFor(any());
    }

    @Test
    void singleArgumentFormQueriesResultsOncePerCall() {
        UUID id = UUID.randomUUID();
        when(resolver.statusesFor(any())).thenReturn(Map.of(id, MatchResultStatus.PUBLISHED));

        assertThat(emptiness.emptyAmong(List.of(id))).isEmpty();

        verify(resolver, times(1)).statusesFor(any());
    }
}
