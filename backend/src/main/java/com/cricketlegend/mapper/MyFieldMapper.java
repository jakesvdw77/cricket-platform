package com.cricketlegend.mapper;

import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.dto.MyFieldDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

/**
 * docs/specs/121: {@link PlayingArea} to the read-only Field Directory row. {@code home} is club-relative so the service
 * supplies it as an extra source parameter (as {@link PlayingAreaMapper} does for its derived values).
 */
@Mapper(componentModel = "spring")
public interface MyFieldMapper {

    @Mapping(target = "id", source = "entity.id")
    @Mapping(target = "name", source = "entity.name")
    @Mapping(target = "owner", source = "entity.ownerName", qualifiedByName = "blankToNull")
    @Mapping(target = "addressLine1", source = "entity.address", qualifiedByName = "addressLine1")
    @Mapping(target = "city", source = "entity.address.city")
    @Mapping(target = "provinceState", source = "entity.address.provinceState")
    @Mapping(target = "postalCode", source = "entity.address.postalCode")
    @Mapping(target = "country", source = "entity.address.country")
    @Mapping(target = "mapUrl", source = "entity.mapUrl")
    @Mapping(target = "verified", source = "entity.verificationStatus", qualifiedByName = "isVerified")
    @Mapping(target = "home", source = "home")
    MyFieldDto toDto(PlayingArea entity, boolean home);

    @Named("blankToNull")
    default String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** Number and street, joined; null when neither is set. */
    @Named("addressLine1")
    default String addressLine1(Address address) {
        if (address == null) {
            return null;
        }
        String number = blankToNull(address.getNumber());
        String street = blankToNull(address.getStreet());
        if (number == null) {
            return street;
        }
        return street == null ? number : number + " " + street;
    }

    @Named("isVerified")
    default boolean isVerified(PlayingAreaVerificationStatus status) {
        return status == PlayingAreaVerificationStatus.VERIFIED;
    }
}
