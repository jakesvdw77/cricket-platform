package com.cricketlegend.mapper;

import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.dto.AddressDto;
import com.cricketlegend.dto.PlatformPlayingAreaDto;
import com.cricketlegend.dto.PlayingAreaDto;
import com.cricketlegend.dto.PlayingAreaLinkedClubDto;
import com.cricketlegend.dto.PlayingAreaRefDto;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * docs/specs/099-fields-directory.md. The club-relative and derived values ({@code createdByClubName}, {@code
 * linkedHome}, {@code matchCount}, linked clubs, duplicates) are not on {@link PlayingArea}, so the service supplies
 * them as extra source parameters, as {@code ClubProfileMapper} does for the club name. There is no entity-from-request
 * mapping: {@code PlayingAreaWriter} applies a request through validated setters (the codebase's no-update-in-place
 * style); only the address leg is mapped here.
 */
@Mapper(componentModel = "spring")
public interface PlayingAreaMapper {

    @Mapping(target = "createdByClubName", source = "createdByClubName")
    @Mapping(target = "linkedHome", source = "linkedHome")
    @Mapping(target = "matchCount", source = "matchCount")
    PlayingAreaDto toDto(PlayingArea entity, String createdByClubName, boolean linkedHome, long matchCount);

    @Mapping(target = "createdByClubName", source = "createdByClubName")
    @Mapping(target = "matchCount", source = "matchCount")
    @Mapping(target = "linkedClubs", source = "linkedClubs")
    @Mapping(target = "possibleDuplicates", source = "possibleDuplicates")
    PlatformPlayingAreaDto toPlatformDto(
            PlayingArea entity,
            String createdByClubName,
            long matchCount,
            List<PlayingAreaLinkedClubDto> linkedClubs,
            List<PlayingAreaRefDto> possibleDuplicates);

    @Mapping(target = "city", source = "address.city")
    @Mapping(target = "country", source = "address.country")
    PlayingAreaRefDto toRefDto(PlayingArea entity);

    AddressDto toDto(Address address);

    Address toAddress(AddressDto dto);
}
