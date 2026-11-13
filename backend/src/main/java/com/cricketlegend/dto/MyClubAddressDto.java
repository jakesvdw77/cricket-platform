package com.cricketlegend.dto;

/** docs/specs/148: the club address; a part that is not set is null. */
public record MyClubAddressDto(String number, String street, String city, String provinceState, String country, String postalCode) {
}
