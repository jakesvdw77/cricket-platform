package com.cricketlegend.mapper;

import com.cricketlegend.domain.Match;
import com.cricketlegend.dto.MatchDto;
import org.mapstruct.Mapper;

/**
 * Flat field-for-field mapping, inferred by MapStruct. See docs/specs/029-league-management.md.
 */
@Mapper(componentModel = "spring")
public interface MatchMapper {

    MatchDto toDto(Match entity);
}
