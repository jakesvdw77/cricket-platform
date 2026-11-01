package com.cricketlegend.dto;

import java.util.List;

/** docs/specs/135: one side of a match; {@code players} is empty unless the side is announced. */
public record MyMatchSideDto(String name, String logoUrl, boolean mine, boolean announced, List<MyMatchPlayerDto> players) {}
