package com.cricketlegend.mapper;

import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.dto.AddressDto;
import com.cricketlegend.dto.ClubProfileDto;
import org.mapstruct.Mapper;

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
    // which MapStruct infers for the Address -> AddressDto leg automatically.
    ClubProfileDto toDto(ClubProfile entity);

    // number/street/city/provinceState/country/postalCode all exist with matching names on both
    // sides — MapStruct maps all six by convention, no explicit @Mapping needed. Declared here
    // since ClubProfile is the only consumer today — trivial to hoist into a shared
    // AddressMapper and pull in via @Mapper(uses = AddressMapper.class) the moment a second
    // entity needs the same mapping, no rework of this method itself.
    AddressDto toDto(Address address);
}
