package com.cricketlegend.dto;

/** docs/specs/123: a season's playing conditions for the Player Hub: no ids, no uploader, no upload time. */
public record MyPlayingConditionsDto(
        String documentUrl,
        Integer maxOversPerInnings,
        Integer powerplayOvers,
        Integer maxOversPerBowler,
        String fieldingRestrictionsNotes,
        boolean allowSubstitutions,
        Integer pointsForWin,
        Integer pointsForLoss,
        Integer pointsForDraw,
        Integer pointsForNoResult,
        Integer pointsForForfeitWin,
        boolean bonusPointsEnabled,
        Integer bonusBattingOversThreshold,
        Integer bonusBowlingRestrictionPercentage,
        String additionalNotes) {
}
