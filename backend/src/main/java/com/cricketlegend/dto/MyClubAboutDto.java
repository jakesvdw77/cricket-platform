package com.cricketlegend.dto;

/** docs/specs/148: the About facts; each part is null when its switch is off or the club set no value. */
public record MyClubAboutDto(String type, MyClubAddressDto address, String phone, String email) {
}
