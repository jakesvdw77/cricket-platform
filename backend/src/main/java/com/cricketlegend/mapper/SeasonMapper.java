package com.cricketlegend.mapper;

import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.SeasonDto;
import org.mapstruct.Mapper;

/**
 * {@code label}/{@code startDate}/{@code endDate} all exist with matching names on {@link
 * Season}, inferred by MapStruct. See docs/specs/029-league-management.md.
 */
@Mapper(componentModel = "spring")
public interface SeasonMapper {

    SeasonDto toDto(Season entity);
}
