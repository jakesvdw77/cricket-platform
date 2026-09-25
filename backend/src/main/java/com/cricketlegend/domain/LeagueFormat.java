package com.cricketlegend.domain;

/**
 * A purely descriptive match-format tag a club admin can set on a {@link League} — cosmetic
 * display text only, with no relationship to, and no cross-check against, {@link
 * LeaguePlayingConditions}'s genuinely per-season match-format fields (see
 * docs/specs/053-league-extended-profile.md's Non-goals). A fixed, closed set, following this
 * codebase's established enum convention ({@link LeagueSource}, {@code ClubProfileType}) — no
 * club-admin-authored custom format string, unlike {@link SocialLink#getPlatform()}'s
 * deliberately free-text label.
 */
public enum LeagueFormat {
    T20,
    T30,
    T45,
    T50,
    ONE_DAY,
    THREE_DAY,
    FIVE_DAY
}
