package com.cricketlegend.dto;

import java.util.UUID;

/** docs/specs/157-photo-gallery.md: one tag of a photo, with the name to show. {@code type} is LEAGUE, TEAM or PLAYER. */
public record GalleryTagDto(String type, UUID id, String name) {
}
