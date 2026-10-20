package com.cricketlegend.mapper;

import com.cricketlegend.dto.LeaderboardCatalogueDto.LeaderboardBoardInfo;
import com.cricketlegend.dto.LeaderboardCatalogueDto.LeaderboardColumnInfo;
import com.cricketlegend.service.support.LeaderboardBoard;
import com.cricketlegend.service.support.LeaderboardColumn;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/** docs/specs/103-player-stats.md: catalogue entries (boards and standings columns) as their API shape. Enums map to their names. */
@Mapper(componentModel = "spring")
public interface LeaderboardMapper {

    LeaderboardBoardInfo toInfo(LeaderboardBoard board);

    @Mapping(target = "sortable", constant = "true")
    LeaderboardColumnInfo toColumnInfo(LeaderboardColumn column);
}
