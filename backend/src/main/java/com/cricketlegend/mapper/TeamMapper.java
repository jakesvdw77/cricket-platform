package com.cricketlegend.mapper;

import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateTeamRequest;
import com.cricketlegend.dto.TeamDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * {@code name}/{@code logoUrl} exist with matching names on both {@link Team} and {@link
 * CreateTeamRequest}, inferred by MapStruct automatically ({@code logoUrl} added by
 * docs/specs/027-team-profile.md). See docs/specs/026-teams.md.
 */
@Mapper(componentModel = "spring")
public interface TeamMapper {

    TeamDto toDto(Team entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "clubId", ignore = true)
    @Mapping(target = "sectionId", ignore = true)
    @Mapping(target = "active", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    Team toEntity(CreateTeamRequest request);
}
