package com.cricketlegend.mapper;

import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.domain.Sponsor;
import com.cricketlegend.dto.CreateSponsorRequest;
import com.cricketlegend.dto.SocialLinkDto;
import com.cricketlegend.dto.SponsorDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * {@code name}/{@code website}/{@code email}/{@code phone}/{@code logoUrl}/{@code bannerUrl} all
 * exist with matching names on both sides. Declaring the element-level {@code SocialLinkDto
 * toDto(SocialLink)}/{@code SocialLink toEntity(SocialLinkDto)} one-liners below is enough for
 * MapStruct to auto-generate the {@code List<SocialLink>}/{@code List<SocialLinkDto>} mapping in
 * both directions — a deliberate departure from {@code ClubProfileMapper}'s manual {@code
 * toSocialLinks} helper (that one predates docs/specs/022-club-social-media.md's {@code toEntity}
 * gap; {@code SponsorMapper} is brand new and isn't constrained by that history). See
 * docs/specs/023-sponsors.md.
 */
@Mapper(componentModel = "spring")
public interface SponsorMapper {

    SponsorDto toDto(Sponsor entity);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "clubId", ignore = true)
    @Mapping(target = "active", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "updatedBy", ignore = true)
    Sponsor toEntity(CreateSponsorRequest request);

    SocialLinkDto toDto(SocialLink socialLink);

    SocialLink toEntity(SocialLinkDto dto);
}
