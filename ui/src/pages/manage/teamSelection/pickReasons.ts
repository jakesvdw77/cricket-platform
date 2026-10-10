import type { TeamSelectionReasonCode } from '../../../api/teamSelectionApi'

// docs/specs/093-team-selection-hub.md: why a Players grid cell cannot be picked, in words (the tooltip of a muted cell).
// Codes come from the server's SelectionRules (spec 076), so a cell reported pickable is accepted by the apply endpoint.
export const REASON_TEXT: Record<TeamSelectionReasonCode, string> = {
  AGE_INELIGIBLE: 'Not eligible for this team under its age rule',
  SAID_UNAVAILABLE: 'Said they are unavailable',
  NOT_CONFIRMED: 'Has not confirmed they are available',
  TAKEN_FOR_SLOT: 'Already picked for another match in this time slot',
  NOT_IN_POOL: "Not in this team's selection pool",
  TEAM_FULL: 'This team is full',
  POSITION_INVALID: 'No valid batting position is free',
}

export function reasonText(code: TeamSelectionReasonCode | null): string {
  return code ? (REASON_TEXT[code] ?? 'Cannot be picked') : 'Cannot be picked'
}
