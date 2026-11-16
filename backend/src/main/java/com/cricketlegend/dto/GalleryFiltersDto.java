package com.cricketlegend.dto;

import java.util.List;

/**
 * docs/specs/157-photo-gallery.md: the leagues, teams and players that at least one photo is tagged to, for the filter
 * selects (a select never offers an empty result). Each entry is a {@link GalleryTagDto}; the lists are sorted by name.
 */
public record GalleryFiltersDto(List<GalleryTagDto> leagues, List<GalleryTagDto> teams, List<GalleryTagDto> players) {
}
