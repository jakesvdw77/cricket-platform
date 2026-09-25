package com.cricketlegend.mapper;

import com.cricketlegend.domain.League;
import com.cricketlegend.dto.LeagueDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * {@code name}/{@code source}/{@code maxPlayingXiSize}/{@code minAge}/{@code maxAge}/{@code
 * ageCutoffDate} all exist with matching names on {@link League}, inferred by MapStruct. See
 * docs/specs/029-league-management.md.
 *
 * <p>{@code currentSeasonTeamCount}/{@code currentSeasonLabel}/{@code
 * currentSeasonPlayingConditionsUrl} (050) are derived, not present on {@link League} itself —
 * MapStruct can't infer them, so they're ignored here and filled in afterward by {@code
 * LeagueServiceImpl.list()}, the same "map via MapStruct, then reconstruct the record adding
 * computed fields" pattern {@code MatchMapper}/{@code MatchServiceImpl.enrichAnnounced} already use
 * for {@code homeSideAnnounced}/{@code awaySideAnnounced}.
 */
@Mapper(componentModel = "spring")
public interface LeagueMapper {

    @Mapping(target = "currentSeasonTeamCount", ignore = true)
    @Mapping(target = "currentSeasonLabel", ignore = true)
    @Mapping(target = "currentSeasonPlayingConditionsUrl", ignore = true)
    LeagueDto toDto(League entity);
}
