package com.cricketlegend.mapper;

import com.cricketlegend.dto.TeamStatsTableDto.TeamStatsColumnInfo;
import com.cricketlegend.service.support.TeamStatsColumn;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/** docs/specs/116-team-stats.md: the team table's columns as their API shape. Enums map to their names. */
@Mapper(componentModel = "spring")
public interface TeamStatsMapper {

    @Mapping(target = "sortable", constant = "true")
    TeamStatsColumnInfo toColumnInfo(TeamStatsColumn column);
}
