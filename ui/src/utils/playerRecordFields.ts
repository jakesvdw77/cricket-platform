import type { RecordCardField } from '../components/RecordCard'
import type { Player } from '../api/playerApi'

// The RecordCardField set for a Player — shared by PlayerList.tsx's own cards and TeamFormPage.
// tsx's Squad tab cards (docs/specs/029-league-management.md), so both list a player's key
// identifying details identically rather than duplicating the logic a second time. Pulled out
// into its own utility (rather than exported straight from PlayerList.tsx) so importing it
// doesn't defeat React Fast Refresh on that page — same reasoning as sponsorRecordFields.ts.
export function playerRecordFields(player: Player): RecordCardField[] {
  const fields: RecordCardField[] = []
  if (player.dateOfBirth) {
    fields.push({ label: 'Date of birth', value: player.dateOfBirth })
  }
  if (player.clubMembershipNumber) {
    fields.push({ label: 'Membership number', value: player.clubMembershipNumber })
  }
  return fields
}
