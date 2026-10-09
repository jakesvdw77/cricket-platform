package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** {@link MatchSlots#takenFor}: the per-team view of the batch holders, matching the single-match {@code taken}. */
class MatchSlotsTakenForTest {

    private static final UUID PLAYER = UUID.randomUUID();
    private static final UUID TEAM_ONE = UUID.randomUUID();
    private static final UUID TEAM_TWO = UUID.randomUUID();

    private static TakenBy by(UUID teamId, boolean sameMatch, Instant when) {
        return new TakenBy(teamId, "Team", UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), when, "slot",
                UUID.randomUUID(), sameMatch, false);
    }

    @Test
    void theOwnSideOfTheSameMatchIsNeverHeldAgainstTheTeam() {
        List<MatchSlots.Held> held = List.of(new MatchSlots.Held(PLAYER, by(TEAM_ONE, true, Instant.EPOCH)));

        assertThat(MatchSlots.takenFor(held, TEAM_ONE)).isEmpty();
    }

    @Test
    void theOtherSideOfADerbyIsHeldAgainstTheTeam() {
        TakenBy other = by(TEAM_TWO, true, Instant.EPOCH);

        assertThat(MatchSlots.takenFor(List.of(new MatchSlots.Held(PLAYER, other)), TEAM_ONE))
                .isEqualTo(Map.of(PLAYER, other));
    }

    @Test
    void aSameTeamSideInAnotherMatchIsHeldAgainstTheTeam() {
        TakenBy elsewhere = by(TEAM_ONE, false, Instant.EPOCH);

        assertThat(MatchSlots.takenFor(List.of(new MatchSlots.Held(PLAYER, elsewhere)), TEAM_ONE))
                .isEqualTo(Map.of(PLAYER, elsewhere));
    }

    @Test
    void whenSeveralHoldThePlayerTheEarliestMatchWins() {
        TakenBy early = by(TEAM_TWO, false, Instant.EPOCH);
        TakenBy late = by(TEAM_TWO, false, Instant.EPOCH.plusSeconds(3600));

        assertThat(MatchSlots.takenFor(
                        List.of(new MatchSlots.Held(PLAYER, late), new MatchSlots.Held(PLAYER, early)), TEAM_ONE))
                .isEqualTo(Map.of(PLAYER, early));
    }
}
