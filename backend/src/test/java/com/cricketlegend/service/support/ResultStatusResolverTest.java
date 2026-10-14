package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.MatchResultStatus;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.repository.MatchResultRepository;
import com.cricketlegend.repository.MatchResultRepository.MatchStatusView;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** docs/specs/100-match-results-core.md: one batched query; a match with no row has no entry (NONE to the caller). */
@ExtendWith(MockitoExtension.class)
class ResultStatusResolverTest {

    @Mock
    private MatchResultRepository repository;

    private static MatchStatusView view(UUID matchId, ResultStatus status) {
        return new MatchStatusView() {
            @Override
            public UUID getMatchId() {
                return matchId;
            }

            @Override
            public ResultStatus getStatus() {
                return status;
            }
        };
    }

    @Test
    void mapsPublishedAndDraftAndOmitsMatchesWithoutAResult() {
        UUID published = UUID.randomUUID();
        UUID draft = UUID.randomUUID();
        UUID none = UUID.randomUUID();
        List<UUID> ids = List.of(published, draft, none);
        when(repository.findStatusesByMatchIdIn(ids))
                .thenReturn(List.of(view(published, ResultStatus.PUBLISHED), view(draft, ResultStatus.DRAFT)));

        Map<UUID, MatchResultStatus> result = new ResultStatusResolver(repository).statusesFor(ids);

        assertThat(result).containsEntry(published, MatchResultStatus.PUBLISHED)
                .containsEntry(draft, MatchResultStatus.DRAFT)
                .doesNotContainKey(none);
        verify(repository).findStatusesByMatchIdIn(ids);
    }

    @Test
    void noMatchesMeansNoQuery() {
        assertThat(new ResultStatusResolver(repository).statusesFor(List.of())).isEmpty();
        verifyNoInteractions(repository);
    }
}
