package com.cricketlegend.dto;

/**
 * POST /api/v1/platform/media response — the public {@code /media/**} path to hand back into
 * {@code logoUrl}/{@code bannerUrl} on a subsequent profile save. See
 * docs/specs/012-club-profile.md.
 */
public record MediaUploadResponse(String url) {
}
