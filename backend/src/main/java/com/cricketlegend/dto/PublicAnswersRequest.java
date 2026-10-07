package com.cricketlegend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/** PUT .../players/{playerId}/answers body. */
public record PublicAnswersRequest(@NotNull @Valid List<PublicAnswerDto> answers) {
}
