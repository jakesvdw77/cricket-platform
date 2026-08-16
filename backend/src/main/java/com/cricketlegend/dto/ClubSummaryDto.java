package com.cricketlegend.dto;

/**
 * Pre-auth public club shape — name/slug only, no branding/membership detail. Same "no sensitive
 * data before acceptance" rule as 003's public invitation endpoint. See
 * docs/specs/004-landing-page.md.
 */
public record ClubSummaryDto(String name, String slug) {
}
