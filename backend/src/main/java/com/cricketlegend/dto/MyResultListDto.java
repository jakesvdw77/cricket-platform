package com.cricketlegend.dto;

import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardPageInfo;
import java.util.List;

/** docs/specs/145: one page of the held player's results shown in the Player Hub, newest first. */
public record MyResultListDto(MyResultScopeDto scope, LeaderboardPageInfo page, List<MyResultRowDto> rows) {}
