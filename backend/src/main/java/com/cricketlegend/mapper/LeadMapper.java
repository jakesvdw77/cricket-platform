package com.cricketlegend.mapper;

import com.cricketlegend.domain.Lead;
import com.cricketlegend.dto.CreateLeadRequest;
import com.cricketlegend.dto.LeadDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface LeadMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "convertedClubId", ignore = true)
    @Mapping(target = "contactedByPersonId", ignore = true)
    @Mapping(target = "contactedAt", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    Lead toEntity(CreateLeadRequest request);

    LeadDto toDto(Lead lead);
}
