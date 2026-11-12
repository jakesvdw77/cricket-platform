package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.MatchSelectionState;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Nothing is revealed before the club announces; the twelfth man counts as selected. */
class MySelectionRuleTest {

    private final UUID team = UUID.randomUUID();
    private final UUID player = UUID.randomUUID();

    private MatchSide side(boolean announced, UUID twelfth) {
        return MatchSide.builder().id(UUID.randomUUID()).teamId(team).announced(announced).twelfthManPlayerId(twelfth).build();
    }

    @Test
    void anUnannouncedSideRevealsNothing() {
        MatchSide side = side(false, null);
        Map<UUID, List<MatchSidePlayer>> players =
                Map.of(side.getId(), List.of(MatchSidePlayer.builder().playerProfileId(player).build()));
        assertThat(MySelectionRule.state(List.of(side), players, Set.of(team), player))
                .isEqualTo(MatchSelectionState.NOT_ANNOUNCED);
        assertThat(MySelectionRule.state(List.of(), Map.of(), Set.of(team), player)).isEqualTo(MatchSelectionState.NOT_ANNOUNCED);
    }

    @Test
    void anAnnouncedSideSelectsOrNotAndTheTwelfthManIsSelected() {
        MatchSide side = side(true, null);
        Map<UUID, List<MatchSidePlayer>> in =
                Map.of(side.getId(), List.of(MatchSidePlayer.builder().playerProfileId(player).build()));
        assertThat(MySelectionRule.state(List.of(side), in, Set.of(team), player)).isEqualTo(MatchSelectionState.SELECTED);
        assertThat(MySelectionRule.state(List.of(side), Map.of(), Set.of(team), player)).isEqualTo(MatchSelectionState.NOT_SELECTED);
        assertThat(MySelectionRule.state(List.of(side(true, player)), Map.of(), Set.of(team), player))
                .isEqualTo(MatchSelectionState.SELECTED);
        assertThat(MySelectionRule.state(List.of(side), Map.of(), Set.of(UUID.randomUUID()), player))
                .isEqualTo(MatchSelectionState.NOT_ANNOUNCED);
    }
}
