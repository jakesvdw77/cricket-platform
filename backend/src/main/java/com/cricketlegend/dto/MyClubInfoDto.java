package com.cricketlegend.dto;

import java.util.List;

/**
 * docs/specs/148-player-hub-club-info.md: the Club info page minus the directory rows. A block that is switched off or
 * has no data is null (never sent). No internal id appears here.
 */
public record MyClubInfoDto(
        String clubName,
        List<MyClubTabDto> tabs,
        MyClubAboutDto about,
        MyClubLinksDto links,
        MyClubLogosDto logos,
        MyClubDirectoryDto directory) {
}
