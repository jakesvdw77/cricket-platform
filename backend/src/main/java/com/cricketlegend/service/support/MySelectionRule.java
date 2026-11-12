package com.cricketlegend.service.support;

import com.cricketlegend.domain.MatchSelectionState;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The one rule for whether a held player is selected for a match, shared by the Hub matches list and the availability
 * history (docs/specs/135, 119): SELECTED (the twelfth man included) when the player is on an announced side of one of
 * their teams, NOT_SELECTED once such a side is announced and does not hold them, else NOT_ANNOUNCED (nothing is revealed
 * before the club announces).
 */
public final class MySelectionRule {

    private MySelectionRule() {}

    public static MatchSelectionState state(
            List<MatchSide> sides, Map<UUID, List<MatchSidePlayer>> playersBySide, Set<UUID> myTeams, UUID profileId) {
        boolean announced = false;
        for (MatchSide side : sides) {
            if (!myTeams.contains(side.getTeamId()) || !side.isAnnounced()) {
                continue;
            }
            announced = true;
            boolean inXi = playersBySide.getOrDefault(side.getId(), List.of()).stream()
                    .anyMatch(p -> profileId.equals(p.getPlayerProfileId()));
            if (inXi || profileId.equals(side.getTwelfthManPlayerId())) {
                return MatchSelectionState.SELECTED;
            }
        }
        return announced ? MatchSelectionState.NOT_SELECTED : MatchSelectionState.NOT_ANNOUNCED;
    }
}
