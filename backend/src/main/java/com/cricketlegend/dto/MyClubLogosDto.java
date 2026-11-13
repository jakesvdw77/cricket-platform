package com.cricketlegend.dto;

/** docs/specs/148: the stored logo and banner paths; {@code downloadable} is the club's download switch. */
public record MyClubLogosDto(String logoUrl, String bannerUrl, boolean downloadable) {
}
