package com.cricketlegend.dto;

/** docs/specs/148: the directory summary; {@code phoneShown}/{@code emailShown} say which columns the club allows. */
public record MyClubDirectoryDto(long total, boolean phoneShown, boolean emailShown) {
}
