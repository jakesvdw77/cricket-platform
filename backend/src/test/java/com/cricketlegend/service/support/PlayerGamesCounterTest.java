package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.service.support.PlayerGamesCounter.PlayerMatch;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlayerGamesCounterTest {

    private final UUID player = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();
    private final UUID selectedOnly = UUID.randomUUID();
    private final UUID resultOnly = UUID.randomUUID();
    private final UUID both = UUID.randomUUID();
    private final UUID selectedButNotOnResult = UUID.randomUUID();

    @Test
    void aMatchCountsOnceFromAResultOrFromASelectionWithoutAPublishedResult() {
        var counts = PlayerGamesCounter.count(
                List.of(new PlayerMatch(player, resultOnly), new PlayerMatch(player, both)),
                List.of(
                        new PlayerMatch(player, selectedOnly),
                        new PlayerMatch(player, both),
                        new PlayerMatch(player, selectedButNotOnResult),
                        new PlayerMatch(other, selectedButNotOnResult)),
                Set.of(resultOnly, both, selectedButNotOnResult));

        // result-only, both (once), and the selection-only match; the selection for a published match he is not on does not count
        assertThat(counts).containsEntry(player, 3L).doesNotContainKey(other);
    }
}
