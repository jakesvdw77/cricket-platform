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
    private final MatchSideRepository sides = mock(MatchSideRepository.class);
    private final MatchEmptiness emptiness = new MatchEmptiness(
            resolver, polls, mock(MatchSquadMemberRepository.class), sides,
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

    @Test
    void aMatchWhoseOnlySidesAreEmptyIsEmptyAndOneWithASideHoldingContentIsTeamSelection() {
        UUID emptySideOnly = UUID.randomUUID();
        UUID withContent = UUID.randomUUID();
        // the repository query already excludes empty sides, so only the match with content is returned
        when(sides.findMatchIdsWithSideByMatchIdIn(any())).thenReturn(List.of(withContent));
        List<UUID> ids = List.of(emptySideOnly, withContent);

        assertThat(emptiness.emptyAmong(ids, Map.of())).containsExactly(emptySideOnly);
        assertThat(emptiness.attachmentsFor(ids, Map.of()).get(withContent))
                .containsExactly(MatchEmptiness.Attachment.TEAM_SELECTION);
    }
}
