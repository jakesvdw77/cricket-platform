package com.cricketlegend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * A single social media / external link, nested inside {@link ClubProfileDto} and {@link
 * UpdateClubProfileRequest}. {@code platform} is a free-text label, not an enum — see
 * docs/specs/022-club-social-media.md. {@code url}'s {@code @Pattern} mirrors {@link
 * UpdateClubProfileRequest}'s {@code website} field — a basic format check, not a
 * link-verification service.
 */
public record SocialLinkDto(
        @NotBlank String platform, @NotBlank @Pattern(regexp = "^https?://.+") String url) {
}
