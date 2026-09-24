package com.cricketlegend.mapper;

import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.dto.LeaguePlayingConditionsDto;
import org.mapstruct.Mapper;

/**
 * Flat field-for-field mapping, inferred by MapStruct. See
 * docs/specs/050-league-schedule-and-fixtures.md.
 */
@Mapper(componentModel = "spring")
public interface LeaguePlayingConditionsMapper {

    LeaguePlayingConditionsDto toDto(LeaguePlayingConditions entity);
}
