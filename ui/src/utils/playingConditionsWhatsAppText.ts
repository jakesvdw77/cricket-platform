import type { PlayingConditionsPayload } from '../api/leaguePlayingConditionsApi'
import { resolveEffectiveMaxOversPerBowler } from './playingConditions'

// docs/specs/052-league-playing-conditions.md UI Requirements item 8 — the captain-friendly
// summary's WhatsApp-formatted (*bold*) counterpart to teamSheetWhatsAppText.ts's own
// generateTeamSheetWhatsAppText, mirroring its block-based join structure exactly. Synchronous
// (no logo/image to fetch, unlike the PDF path). Restates only the structured fields the Goals
// section names — overs, powerplay, points, bonus-point rule — never the free-text
// fieldingRestrictionsNotes/additionalNotes fields, which belong to the Full Document, not this
// derived summary.
export function generatePlayingConditionsWhatsAppText(
  leagueName: string,
  seasonLabel: string,
  conditions: PlayingConditionsPayload,
): string {
  const blocks: string[][] = [[`🏏 *${leagueName} — Playing Conditions*`, seasonLabel]]

  const effectiveMaxOversPerBowler = resolveEffectiveMaxOversPerBowler(
    conditions.maxOversPerInnings,
    conditions.maxOversPerBowler,
  )

  blocks.push([
    '*Match Format*',
    `Overs per innings: ${conditions.maxOversPerInnings}`,
    `Powerplay overs: ${conditions.powerplayOvers}`,
    `Max overs per bowler: ${effectiveMaxOversPerBowler ?? 'N/A'}`,
  ])

  blocks.push([
    '*Points*',
    `Win: ${conditions.pointsForWin}`,
    `Loss: ${conditions.pointsForLoss}`,
    `Draw: ${conditions.pointsForDraw}`,
    `No result: ${conditions.pointsForNoResult}`,
    `Forfeit win: ${conditions.pointsForForfeitWin}`,
  ])

  if (
    conditions.bonusPointsEnabled &&
    conditions.bonusBattingOversThreshold != null &&
    conditions.bonusBowlingRestrictionPercentage != null
  ) {
    const threshold = conditions.bonusBattingOversThreshold
    blocks.push([
      '*Bonus Points*',
      `Chase the target before over ${threshold} for a bonus point`,
      `Restrict them to ${conditions.bonusBowlingRestrictionPercentage}% of the target (or bowl them out) before over ${threshold} for a bonus point`,
    ])
  }

  return blocks.map((block) => block.join('\n')).join('\n\n')
}
