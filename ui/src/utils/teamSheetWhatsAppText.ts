import type { Match } from '../api/matchApi'
import type { PlayingRole } from '../api/matchSideApi'
import type { Player } from '../api/playerApi'
import type { TeamSheetSide } from './teamSheetPdf'

// docs/specs/039-team-sheet-whatsapp-text.md — ported from the legacy Cricket Legend app's
// `TeamsheetTemplatesDialog.tsx`'s `buildWhatsAppText`/`buildTeamWhatsAppLines`/`getRoleText`, but
// simplified: legacy had no persisted per-side player role and had to *infer* one via
// `getEffectiveRole`/`deriveRoleFromProfile` plus a per-MatchSide override map. This codebase
// already gives every `MatchSidePlayer` a real, persisted `role` (docs/specs/029), so this table is
// read as-is — no inference, no override layer.
const ROLE_EMOJI: Record<PlayingRole, string> = {
  BATSMAN: '🏏',
  BOWLER: '🔴',
  ALL_ROUNDER: '🏏🔴',
}

export function getRoleEmoji(role: PlayingRole, isWicketKeeper: boolean): string {
  return isWicketKeeper ? `${ROLE_EMOJI[role]}🧤` : ROLE_EMOJI[role]
}

// Same "raw UUID would be a visible defect" reasoning as teamSheetPdf.ts's own (unexported)
// playerName() — kept as an identical, separately-defined local copy rather than importing a
// private helper from a sibling module.
function playerName(player: Player | undefined): string {
  return player ? `${player.firstName} ${player.lastName}` : 'Unknown player'
}

interface RosterLine {
  emoji: string
  name: string
  isCaptain: boolean
  squadJerseyNumber: number | null
}

// Duplicates the same battingOrder-sort + squad join teamSheetPdf.ts's own (unexported)
// resolveRoster() already does — deliberately, matching that module's own precedent of not
// extracting a shared helper for a ~10-line block (docs/plans/030-team-sheet-communication.md's
// Flag #2), so this util doesn't reach into already-shipped, tested PDF code either.
function resolveRosterLines(side: TeamSheetSide): RosterLine[] {
  const squadById = new Map(side.squad.map((member) => [member.playerProfileId, member]))
  const players = side.side?.players ?? []

  return [...players]
    .sort((a, b) => a.battingOrder - b.battingOrder)
    .map((entry) => ({
      emoji: getRoleEmoji(entry.role, side.side?.wicketKeeperPlayerId === entry.playerProfileId),
      name: playerName(squadById.get(entry.playerProfileId)),
      isCaptain: side.side?.captainPlayerId === entry.playerProfileId,
      squadJerseyNumber: squadById.get(entry.playerProfileId)?.squadJerseyNumber ?? null,
    }))
}

function resolveCaptainName(side: TeamSheetSide): string | null {
  const captainPlayerId = side.side?.captainPlayerId
  if (!captainPlayerId) {
    return null
  }
  return playerName(side.squad.find((candidate) => candidate.playerProfileId === captainPlayerId))
}

function resolveTwelfthManName(side: TeamSheetSide): string | null {
  const twelfthManPlayerId = side.side?.twelfthManPlayerId
  if (!twelfthManPlayerId) {
    return null
  }
  return playerName(side.squad.find((candidate) => candidate.playerProfileId === twelfthManPlayerId))
}

// Builds a WhatsApp-formatted (*bold*/_italic_) plain-text team sheet for the given
// (already scope-filtered) sides — synchronous, unlike generateTeamSheetPdf, since there's no logo
// image to fetch for plain text. `subtitle` is the same already-assembled date/venue/league-season
// line the caller (MatchCard) already computes for the PDF path — reused verbatim, not re-derived.
export function generateTeamSheetWhatsAppText(match: Match, sides: TeamSheetSide[], subtitle: string): string {
  void match // Retained in the signature to mirror generateTeamSheetPdf's own fixed public API —
  // sides/subtitle carry every field this function currently renders; match itself isn't read
  // directly today.

  const headerTeams = sides.map((side) => side.teamName).join(' vs ') || 'Team Sheet'
  const blocks: string[][] = [[`🏏 *${headerTeams}*`, subtitle]]

  sides.forEach((side) => {
    const lines: string[] = [`*${side.teamName} — Playing XI*`]

    const captainName = resolveCaptainName(side)
    if (captainName) {
      lines.push(`⭐ Captain: ${captainName}`)
    }

    const roster = resolveRosterLines(side)
    if (roster.length === 0) {
      lines.push('_Team not yet announced_')
    } else {
      roster.forEach((entry, index) => {
        const numberedName =
          entry.squadJerseyNumber != null ? `#${entry.squadJerseyNumber} ${entry.name}` : entry.name
        const captainSuffix = entry.isCaptain ? ' *(C)*' : ''
        lines.push(`${entry.emoji} ${index + 1}. ${numberedName}${captainSuffix}`)
      })
    }

    const twelfthManName = resolveTwelfthManName(side)
    if (twelfthManName) {
      lines.push(`_12th Man: ${twelfthManName}_`)
    }

    blocks.push(lines)
  })

  blocks.push(['🏏 = Bat  |  🔴 = Bowl  |  🏏🔴 = All-Rounder  |  🧤 = WK'])

  return blocks.map((block) => block.join('\n')).join('\n\n')
}
