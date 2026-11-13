package com.cricketlegend.dto;

import java.util.List;

/** docs/specs/148: one page of the club contact directory plus the A to Z letters of the searched set. */
public record MyClubContactPageDto(List<MyClubContactDto> items, List<String> letters, int page, int size, long total, boolean hasMore) {
}
