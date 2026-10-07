package com.cricketlegend.dto;

import com.cricketlegend.domain.DayPart;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** One bracket of a public round header. */
public record PublicRoundWindowDto(
        UUID windowId, LocalDate windowDate, DayPart dayPart, boolean open, List<PublicRoundMatchDto> matches) {
}
