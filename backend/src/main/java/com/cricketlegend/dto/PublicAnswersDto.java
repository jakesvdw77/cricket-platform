package com.cricketlegend.dto;

import java.util.List;

/** The answers a verified player has saved (GET and PUT .../answers response). */
public record PublicAnswersDto(List<PublicAnswerDto> answers) {
}
