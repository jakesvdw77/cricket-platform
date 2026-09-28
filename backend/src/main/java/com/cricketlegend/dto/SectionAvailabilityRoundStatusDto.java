package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.DayPart;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One player's status for one specific bracket a {@code SectionAvailabilityRound} owns — replaces
 * the pre-fixture-group-selection-revision fixed {@code morningStatus}/{@code afternoonStatus}
 * pair on {@code SectionAvailabilityRoundResponseRowDto}: a round can now own several windows
 * sharing the same {@code dayPart} across different dates, so a specific bracket is only ever
 * addressed by its own {@code windowId} from here on, not {@code dayPart} alone. {@code status} is
 * {@code null} when that player hasn't responded to this bracket yet. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public record SectionAvailabilityRoundStatusDto(
        UUID windowId, DayPart dayPart, LocalDate windowDate, AvailabilityStatus status) {
}
