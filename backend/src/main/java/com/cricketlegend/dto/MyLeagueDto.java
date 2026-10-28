package com.cricketlegend.dto;

import java.util.List;

/**
 * docs/specs/123: one league for the Player Hub (response only), the server twin of the client {@code LeagueShareModel}.
 * No contacts and no manager-only data. {@code playingConditions} is null when none are set.
 */
public record MyLeagueDto(
        MyLeagueInfoDto league,
        MyLeagueSeasonDto season,
        MyPlayingConditionsDto playingConditions,
        List<MyLeagueTeamDto> teams,
        List<MyScheduleItemDto> schedule,
        List<MyResultItemDto> results,
        MyKeyDatesDto keyDates,
        List<String> shareDisabledFormats) {
}
