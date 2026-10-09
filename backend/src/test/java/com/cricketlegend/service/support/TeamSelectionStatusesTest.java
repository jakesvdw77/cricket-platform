package com.cricketlegend.service.support;

import static com.cricketlegend.domain.TeamSelectionStatus.ANNOUNCED;
import static com.cricketlegend.domain.TeamSelectionStatus.IN_PROGRESS;
import static com.cricketlegend.domain.TeamSelectionStatus.NOT_STARTED;
import static com.cricketlegend.domain.TeamSelectionStatus.READY_TO_ANNOUNCE;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/** The status rules of docs/specs/093-team-selection-hub.md: sides, then matches with one or two own sides. */
class TeamSelectionStatusesTest {

    @Test
    void aSideIsAnnouncedBeforeAnythingElse() {
        assertThat(TeamSelectionStatuses.side(true, 0, false)).isEqualTo(ANNOUNCED);
        assertThat(TeamSelectionStatuses.side(true, 12, true)).isEqualTo(ANNOUNCED);
    }

    @Test
    void aSideWithNoPicksIsNotStartedAndWithUnfilledPlacesInProgress() {
        assertThat(TeamSelectionStatuses.side(false, 0, false)).isEqualTo(NOT_STARTED);
        assertThat(TeamSelectionStatuses.side(false, 7, false)).isEqualTo(IN_PROGRESS);
    }

    @Test
    void aSideWithAllPlacesFilledIsReadyToAnnounce() {
        assertThat(TeamSelectionStatuses.side(false, 11, true)).isEqualTo(READY_TO_ANNOUNCE);
    }

    @Test
    void aSingleSideMatchTakesItsSidesStatus() {
        for (var status : List.of(NOT_STARTED, IN_PROGRESS, READY_TO_ANNOUNCE, ANNOUNCED)) {
            assertThat(TeamSelectionStatuses.match(List.of(status))).isEqualTo(status);
        }
    }

    @Test
    void aDerbyIsOnlyAsFarAlongAsBothSides() {
        assertThat(TeamSelectionStatuses.match(List.of(ANNOUNCED, ANNOUNCED))).isEqualTo(ANNOUNCED);
        assertThat(TeamSelectionStatuses.match(List.of(NOT_STARTED, NOT_STARTED))).isEqualTo(NOT_STARTED);
        assertThat(TeamSelectionStatuses.match(List.of(READY_TO_ANNOUNCE, ANNOUNCED))).isEqualTo(READY_TO_ANNOUNCE);
        assertThat(TeamSelectionStatuses.match(List.of(READY_TO_ANNOUNCE, READY_TO_ANNOUNCE)))
                .isEqualTo(READY_TO_ANNOUNCE);
        assertThat(TeamSelectionStatuses.match(List.of(READY_TO_ANNOUNCE, NOT_STARTED))).isEqualTo(IN_PROGRESS);
        assertThat(TeamSelectionStatuses.match(List.of(ANNOUNCED, IN_PROGRESS))).isEqualTo(IN_PROGRESS);
    }
}
