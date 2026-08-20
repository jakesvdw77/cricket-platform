package com.cricketlegend.domain;

/**
 * The kind of organisation a {@link ClubProfile}'s {@code Club} actually is — see
 * docs/specs/012-club-profile.md, which resolves the "organisation type… needs a field" note
 * tracked under 003-club-onboarding.md in docs/roadmap.md.
 */
public enum ClubProfileType {
    CLUB,
    ACADEMY,
    SCHOOL,
    OTHER
}
