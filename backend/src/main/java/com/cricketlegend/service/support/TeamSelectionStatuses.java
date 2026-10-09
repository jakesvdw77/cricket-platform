package com.cricketlegend.service.support;

import com.cricketlegend.domain.TeamSelectionStatus;
import java.util.Collection;

/**
 * The status rules of docs/specs/093-team-selection-hub.md in one place. A side is ANNOUNCED when
 * announced, NOT_STARTED with nobody picked, READY_TO_ANNOUNCE when every pick but the 12th man has
 * a batting position and the places are all filled (the 12th man is optional), else IN_PROGRESS. A
 * match (a derby has two own sides) is ANNOUNCED when all its sides are, NOT_STARTED when none has a
 * pick, READY_TO_ANNOUNCE when every side is ready or announced, else IN_PROGRESS.
 */
public final class TeamSelectionStatuses {

    private TeamSelectionStatuses() {}

    public static TeamSelectionStatus side(boolean announced, int picked, boolean placesFilled) {
        if (announced) {
            return TeamSelectionStatus.ANNOUNCED;
        }
        if (picked == 0) {
            return TeamSelectionStatus.NOT_STARTED;
        }
        return placesFilled ? TeamSelectionStatus.READY_TO_ANNOUNCE : TeamSelectionStatus.IN_PROGRESS;
    }

    public static TeamSelectionStatus match(Collection<TeamSelectionStatus> sides) {
        if (sides.stream().allMatch(status -> status == TeamSelectionStatus.ANNOUNCED)) {
            return TeamSelectionStatus.ANNOUNCED;
        }
        if (sides.stream().allMatch(status -> status == TeamSelectionStatus.NOT_STARTED)) {
            return TeamSelectionStatus.NOT_STARTED;
        }
        boolean allReady = sides.stream().allMatch(status ->
                status == TeamSelectionStatus.READY_TO_ANNOUNCE || status == TeamSelectionStatus.ANNOUNCED);
        return allReady ? TeamSelectionStatus.READY_TO_ANNOUNCE : TeamSelectionStatus.IN_PROGRESS;
    }
}
