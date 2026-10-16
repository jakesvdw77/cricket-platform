package com.cricketlegend.mapper;

import com.cricketlegend.domain.LeagueSeason;
import com.cricketlegend.dto.LeagueSeasonDatesDto;
import org.mapstruct.Mapper;

/** Flat mapping (docs/specs/111-league-season-dates.md). */
@Mapper(componentModel = "spring")
public interface LeagueSeasonMapper {

    LeagueSeasonDatesDto toDto(LeagueSeason entity);
}
