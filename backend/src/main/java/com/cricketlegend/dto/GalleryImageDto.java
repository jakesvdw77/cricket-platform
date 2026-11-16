package com.cricketlegend.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * docs/specs/157-photo-gallery.md: one photo. {@code uploadedByName} is only filled for a manager (the Hub shows no
 * uploader); {@code mine} says whether the caller added it, so the Hub offers Delete on its own photos only.
 */
public record GalleryImageDto(
        UUID id,
        String thumbUrl,
        String mediumUrl,
        String caption,
        Instant uploadedAt,
        String uploadedByName,
        boolean mine,
        List<GalleryTagDto> tags) {
}
