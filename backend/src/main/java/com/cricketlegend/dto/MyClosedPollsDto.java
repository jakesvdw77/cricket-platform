package com.cricketlegend.dto;

import java.util.List;

/** Polls that closed in the last {@code sinceDays} days, newest closed first; {@code total} counts them before the status filter. */
public record MyClosedPollsDto(int sinceDays, long total, List<MyPollHistoryRowDto> rows) {
}
