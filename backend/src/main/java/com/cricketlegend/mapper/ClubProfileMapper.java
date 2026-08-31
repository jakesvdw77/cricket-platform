package com.cricketlegend.mapper;

import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.domain.SocialLink;
import com.cricketlegend.dto.AddressDto;
import com.cricketlegend.dto.ClubProfileDto;
import com.cricketlegend.dto.SocialLinkDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * No {@code toEntity} — per docs/plans/012-club-profile.md's Flag #4, the service applies an
 * {@code UpdateClubProfileRequest} onto a {@code ClubProfile} via explicit setters (the same
 * manual-setter style {@code ClubServiceImpl.update()} already uses for {@code Club}), not a
 * MapStruct {@code @MappingTarget} update-in-place — no precedent for that pattern in this
 * codebase.
 */
@Mapper(componentModel = "spring")
public interface ClubProfileMapper {

    // clubId/type/logoUrl/bannerUrl/address/email/phone/website/createdAt/updatedAt/updatedBy
    // all exist with matching names on both sides — MapStruct maps all eleven by convention, no
    // explicit @Mapping needed. The nested address is mapped by the toDto(Address) method below,
    // which MapStruct infers for the Address -> AddressDto leg automatically. `name` isn't a
    // ClubProfile field at all (it lives on the separate Club entity, joined only by clubId, no
    // JPA relationship) — the service supplies it as a second, plain-value source parameter,
    // and this @Mapping tells MapStruct which target field it feeds.
    @Mapping(target = "name", source = "clubName")
    ClubProfileDto toDto(ClubProfile entity, String clubName);

    // number/street/city/provinceState/country/postalCode all exist with matching names on both
    // sides — MapStruct maps all six by convention, no explicit @Mapping needed. Declared here
    // since ClubProfile is the only consumer today — trivial to hoist into a shared
    // AddressMapper and pull in via @Mapper(uses = AddressMapper.class) the moment a second
    // entity needs the same mapping, no rework of this method itself.
    AddressDto toDto(Address address);

    // platform/url exist with matching names on both sides — MapStruct maps both by convention.
    // Declaring this element-level method is enough for MapStruct to auto-generate the
    // List<SocialLink> -> List<SocialLinkDto> mapping used by toDto(ClubProfile) above.
    SocialLinkDto toDto(SocialLink socialLink);
}
