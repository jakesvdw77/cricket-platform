package com.cricketlegend.mapper;

import com.cricketlegend.domain.League;
import com.cricketlegend.dto.LeagueDto;
import org.mapstruct.Mapper;

/**
 * {@code name}/{@code source}/{@code maxPlayingXiSize}/{@code allowSubstitutions}/{@code
 * minAge}/{@code maxAge}/{@code ageCutoffDate} all exist with matching names on {@link League},
 * inferred by MapStruct. See docs/specs/029-league-management.md.
 */
@Mapper(componentModel = "spring")
public interface LeagueMapper {

    LeagueDto toDto(League entity);
}
