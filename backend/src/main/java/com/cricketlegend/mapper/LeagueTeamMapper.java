package com.cricketlegend.mapper;

import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.dto.LeagueTeamDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Flat mapping. {@code referencedByMatchCount} is not on the entity — the caller supplies it as the
 * second argument (the batched count for a list, the single-row count elsewhere, 0 for a new row).
 * See docs/specs/070-league-teams.md.
 */
@Mapper(componentModel = "spring")
public interface LeagueTeamMapper {

    @Mapping(target = "referencedByMatchCount", source = "referencedByMatchCount")
    LeagueTeamDto toDto(LeagueTeam entity, long referencedByMatchCount);
}
