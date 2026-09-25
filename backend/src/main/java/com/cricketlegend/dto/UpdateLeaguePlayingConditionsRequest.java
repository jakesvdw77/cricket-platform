package com.cricketlegend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * PUT /api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playing-conditions
 * payload — the structured Match Format / Points System / Bonus Points / Additional Notes fields,
 * saved as one whole form (not field-by-field), per docs/specs/052-league-playing-conditions.md's
 * API Contract. {@code allowSubstitutions} moved here from {@code League} itself (a
 * docs/specs/052-league-playing-conditions.md amendment) — it was never enforced by any backend
 * rule (purely informational display text) and, like the rest of this record's fields, plausibly
 * differs by season, unlike the genuinely long-lived {@code League} row. Cross-field rules
 * ({@code powerplayOvers <= maxOversPerInnings},
 * {@code maxOversPerBowler <= maxOversPerInnings} when set, {@code bonusPointsEnabled=true}
 * requiring both threshold fields, {@code bonusBattingOversThreshold <= maxOversPerInnings} when
 * set) aren't expressible as bean validation and are enforced in
 * {@code LeaguePlayingConditionsServiceImpl.update()}.
 */
public record UpdateLeaguePlayingConditionsRequest(
        @NotNull @Positive Integer maxOversPerInnings,
        @NotNull @Positive Integer powerplayOvers,
        @Positive Integer maxOversPerBowler,
        @Size(max = 2000) String fieldingRestrictionsNotes,
        boolean allowSubstitutions,
        @NotNull @Min(0) Integer pointsForWin,
        @NotNull @Min(0) Integer pointsForLoss,
        @NotNull @Min(0) Integer pointsForDraw,
        @NotNull @Min(0) Integer pointsForNoResult,
        @NotNull @Min(0) Integer pointsForForfeitWin,
        boolean bonusPointsEnabled,
        @Min(1) Integer bonusBattingOversThreshold,
        @Min(1) @Max(100) Integer bonusBowlingRestrictionPercentage,
        @Size(max = 4000) String additionalNotes) {
}
