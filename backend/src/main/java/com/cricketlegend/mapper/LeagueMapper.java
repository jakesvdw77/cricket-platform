package com.cricketlegend.mapper;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.dto.LeagueDto;
import com.cricketlegend.dto.SocialLinkDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * {@code name}/{@code source}/{@code maxPlayingXiSize}/{@code minAge}/{@code maxAge}/{@code
 * ageCutoffDate}/{@code format}/{@code logoUrl}/{@code phone}/{@code website}/{@code email} all
 * exist with matching names on {@link League}, inferred by MapStruct. See
 * docs/specs/029-league-management.md.
 *
 * <p>{@code currentSeasonTeamCount}/{@code currentSeasonLabel}/{@code
 * currentSeasonPlayingConditionsUrl} (050) are derived, not present on {@link League} itself —
 * MapStruct can't infer them, so they're ignored here and filled in afterward by {@code
 * LeagueServiceImpl.list()}, the same "map via MapStruct, then reconstruct the record adding
 * computed fields" pattern {@code MatchMapper}/{@code MatchServiceImpl.enrichAnnounced} already use
 * for {@code homeSideAnnounced}/{@code awaySideAnnounced}.
 *
 * <p>Declaring the element-level {@code SocialLinkDto toDto(SocialLink)}/{@code SocialLink
 * toEntity(SocialLinkDto)} one-liners below (docs/specs/053-league-extended-profile.md) is enough
 * for MapStruct to auto-generate the {@code List<SocialLink>}/{@code List<SocialLinkDto>} mapping
 * in both directions — mirrors {@code SponsorMapper} exactly.
 */
@Mapper(componentModel = "spring")
public interface LeagueMapper {

    @Mapping(target = "currentSeasonTeamCount", ignore = true)
    @Mapping(target = "currentSeasonLabel", ignore = true)
    @Mapping(target = "currentSeasonPlayingConditionsUrl", ignore = true)
    LeagueDto toDto(League entity);

    SocialLinkDto toDto(SocialLink socialLink);

    SocialLink toEntity(SocialLinkDto dto);
}
