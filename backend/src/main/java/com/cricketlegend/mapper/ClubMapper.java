package com.cricketlegend.mapper;

import com.cricketlegend.domain.Club;
import com.cricketlegend.dto.ClubSummaryDto;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface ClubMapper {

    ClubSummaryDto toSummaryDto(Club club);
}
