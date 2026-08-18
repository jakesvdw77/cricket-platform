package com.cricketlegend.mapper;

import com.cricketlegend.domain.Club;
import com.cricketlegend.dto.ClubSummaryDto;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface ClubMapper {

    // id/name/slug all exist with matching names on both sides — MapStruct maps all three by
    // convention, no explicit @Mapping needed.
    ClubSummaryDto toSummaryDto(Club club);
}
