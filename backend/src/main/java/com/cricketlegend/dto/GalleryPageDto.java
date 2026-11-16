package com.cricketlegend.dto;

import java.util.List;

/** docs/specs/157-photo-gallery.md: one page of the gallery, newest first. */
public record GalleryPageDto(List<GalleryImageDto> items, int page, int size, long total, boolean hasMore) {
}
