package com.cricketlegend.mapper;

import com.cricketlegend.dto.LeaderboardCatalogueDto.LeaderboardBoardInfo;
import com.cricketlegend.service.support.LeaderboardBoard;
import org.mapstruct.Mapper;

/** docs/specs/103-player-stats.md: the board catalogue entry as its API shape. Names match, enums map to their names. */
@Mapper(componentModel = "spring")
public interface LeaderboardMapper {

    LeaderboardBoardInfo toInfo(LeaderboardBoard board);
}
