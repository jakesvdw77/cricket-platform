package com.cricketlegend.mapper;

import com.cricketlegend.domain.Match;
import com.cricketlegend.dto.MatchDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Flat field-for-field mapping, inferred by MapStruct. See docs/specs/029-league-management.md.
 * {@code homeSideAnnounced}/{@code awaySideAnnounced} (040) are derived, not present on {@link
 * Match} itself — MapStruct can't infer them, so they're ignored here and filled in afterward by
 * {@code MatchServiceImpl}'s list enrichment. The 069 fields ({@code homePickedCount}, {@code
 * awayPickedCount}, {@code playingXiSize}, {@code polls}) are likewise list-only: ignored here, so
 * {@code null} (and {@code MatchDto} normalises {@code polls} to empty) on every other path.
 */
@Mapper(componentModel = "spring")
public interface MatchMapper {

    @Mapping(target = "homeSideAnnounced", ignore = true)
    @Mapping(target = "awaySideAnnounced", ignore = true)
    @Mapping(target = "homePickedCount", ignore = true)
    @Mapping(target = "awayPickedCount", ignore = true)
    @Mapping(target = "playingXiSize", ignore = true)
    @Mapping(target = "polls", ignore = true)
    MatchDto toDto(Match entity);
}
