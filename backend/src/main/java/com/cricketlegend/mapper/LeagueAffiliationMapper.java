package com.cricketlegend.mapper;

import com.cricketlegend.domain.LeagueAffiliation;
import com.cricketlegend.dto.LeagueAffiliationDto;
import org.mapstruct.Mapper;

/**
 * Flat field-for-field mapping, inferred by MapStruct. See docs/specs/029-league-management.md.
 */
@Mapper(componentModel = "spring")
public interface LeagueAffiliationMapper {

    LeagueAffiliationDto toDto(LeagueAffiliation entity);
}
