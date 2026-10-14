package com.cricketlegend.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** docs/specs/101: link an unlinked scorecard player to a registered player of this club. */
public record LinkResultPlayerRequest(@NotNull UUID playerProfileId) {
}
