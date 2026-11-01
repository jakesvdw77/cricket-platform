package com.cricketlegend.dto;

import com.cricketlegend.domain.AvailabilityStatus;
import java.util.UUID;

/** docs/specs/135: the held player's own answer on the match's squad poll; {@code answer} is null when not answered. */
public record MyMatchAvailabilityDto(AvailabilityStatus answer, UUID pollId, boolean pollOpen) {}
