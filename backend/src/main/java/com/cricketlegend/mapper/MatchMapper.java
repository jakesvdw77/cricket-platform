package com.cricketlegend.mapper;

import com.cricketlegend.domain.Match;
import com.cricketlegend.dto.MatchDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Flat field-for-field mapping, inferred by MapStruct. See docs/specs/029-league-management.md.
 * {@code homeSideAnnounced}/{@code awaySideAnnounced} (040) are derived, not present on {@link
 * Match} itself — MapStruct can't infer them, so they're ignored here and filled in afterward by
 * {@code MatchServiceImpl.enrichAnnounced}.
 */
@Mapper(componentModel = "spring")
public interface MatchMapper {

    @Mapping(target = "homeSideAnnounced", ignore = true)
    @Mapping(target = "awaySideAnnounced", ignore = true)
    MatchDto toDto(Match entity);
}
