import type { LeaguePlayingConditions, PlayingConditionsPayload } from '../api/leaguePlayingConditionsApi'

// docs/specs/052-league-playing-conditions.md UI Requirements item 3 — the one formula both
// PlayingConditionsForm's "(auto: N)" hint and LeagueDetailPage.tsx's read-only rendering (and the
// captain-summary WhatsApp text/PDF) share, so none of them can ever state it differently.
// `maxOversPerBowler` wins when explicitly set; otherwise the conventional one-fifth-of-the-innings
// rule applies, computed here rather than persisted as a resolved value; `null` when there's
// nothing to compute from.
export function resolveEffectiveMaxOversPerBowler(
  maxOversPerInnings: number | null,
  maxOversPerBowler: number | null,
): number | null {
  if (maxOversPerBowler != null) {
    return maxOversPerBowler
  }
  if (maxOversPerInnings != null) {
    return Math.ceil(maxOversPerInnings / 5)
  }
  return null
}

// Shared derivation both LeagueFormPage.tsx and LeagueDetailPage.tsx use to decide "has this
// league+season's structured Playing Conditions ever been saved" and to build the writable payload
// shape (PlayingConditionsForm's initialValues, the playing conditions share text's conditions) from
// the read shape a GET returns — `maxOversPerInnings != null` is the group's own "has this been
// saved" signal (docs/specs/052's UI Requirements item 4): every other required field is always
// non-null alongside it, per the write endpoint's own "saved as one whole form" rule.
export function resolvePlayingConditionsPayload(
  record: LeaguePlayingConditions | null | undefined,
): PlayingConditionsPayload | null {
  if (!record || record.maxOversPerInnings == null) {
    return null
  }

  return {
    maxOversPerInnings: record.maxOversPerInnings,
    powerplayOvers: record.powerplayOvers as number,
    maxOversPerBowler: record.maxOversPerBowler,
    maxBallsPerOver: record.maxBallsPerOver ?? null,
    freeHitOnNoBall: record.freeHitOnNoBall ?? true,
    fieldingRestrictionsNotes: record.fieldingRestrictionsNotes,
    allowSubstitutions: record.allowSubstitutions,
    pointsForWin: record.pointsForWin as number,
    pointsForLoss: record.pointsForLoss as number,
    pointsForDraw: record.pointsForDraw as number,
    pointsForNoResult: record.pointsForNoResult as number,
    pointsForForfeitWin: record.pointsForForfeitWin as number,
    bonusPointsEnabled: record.bonusPointsEnabled,
    bonusBattingOversThreshold: record.bonusBattingOversThreshold,
    bonusBowlingRestrictionPercentage: record.bonusBowlingRestrictionPercentage,
    additionalNotes: record.additionalNotes,
  }
}

// docs/specs/124: the one wording for the two rules, shared by every read view and share format.
export function describeBallsPerOver(maxBallsPerOver: number | null | undefined): string {
  return maxBallsPerOver != null ? `At most ${maxBallsPerOver}, wides and no balls included` : 'No limit'
}

export function describeFreeHit(freeHitOnNoBall: boolean | null | undefined): string {
  return freeHitOnNoBall === false ? 'No' : 'Yes'
}
