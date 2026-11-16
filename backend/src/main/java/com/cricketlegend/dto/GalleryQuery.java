package com.cricketlegend.dto;

import java.util.UUID;

/** docs/specs/157-photo-gallery.md: the search text and the league, team and player filters of a gallery list. All optional. */
public record GalleryQuery(String q, UUID leagueId, UUID teamId, UUID playerId) {
}
