import type { TeamSelectionOverview, TeamSelectionPlayer } from '../../../api/teamSelectionApi'

// docs/specs/156-selection-analysis.md: how often each player is picked across the games in an overview. The one place the
// rules live; the dialog only draws the result.

export interface AnalysisRow {
  playerId: string
  name: string
  // Picks as one of the playing places, and as 12th man.
  playing: number
  twelfth: number
  total: number
  // The games the player said they were available for, or was picked for.
  available: number
  tag: 'ABOVE_AVERAGE' | 'NOT_PICKED' | null
}

export interface SelectionAnalysis {
  rows: AnalysisRow[]
  // Picks per player over every listed player.
  average: number
  // The bar scale: the largest total (at least 1).
  scale: number
  notPicked: number
  // The sides counted (one per match and team), after the filters.
  games: number
}

export interface AnalysisOptions {
  announcedOnly: boolean
}

const fullName = (player: { firstName: string; lastName: string }) => `${player.firstName} ${player.lastName}`.trim()

export function analyseSelection(data: Pick<TeamSelectionOverview, 'matches' | 'players'>, options: AnalysisOptions): SelectionAnalysis {
  const counted = new Set<string>()
  const tally = new Map<string, { name: string; playing: number; twelfth: number; available: number }>()
  const entry = (player: { playerId: string; firstName: string; lastName: string }) => {
    let found = tally.get(player.playerId)
    if (!found) {
      found = { name: fullName(player), playing: 0, twelfth: 0, available: 0 }
      tally.set(player.playerId, found)
    }
    return found
  }
  data.players.forEach((player: TeamSelectionPlayer) => entry(player))

  data.matches.forEach((match) =>
    match.sides.forEach((side) => {
      if (options.announcedOnly && !side.announced) return
      counted.add(`${match.matchId}:${side.teamId}`)
      side.picks.forEach((pick) => {
        const row = entry(pick)
        if (pick.twelfthMan) row.twelfth += 1
        else row.playing += 1
      })
    }),
  )
  data.players.forEach((player) =>
    player.cells.forEach((cell) => {
      if (!counted.has(`${cell.matchId}:${cell.teamId}`)) return
      if (cell.availability === 'AVAILABLE' || cell.picked) entry(player).available += 1
    }),
  )

  const base = Array.from(tally, ([playerId, value]) => ({ playerId, ...value, total: value.playing + value.twelfth }))
  const average = base.length > 0 ? base.reduce((sum, row) => sum + row.total, 0) / base.length : 0
  const rows: AnalysisRow[] = base
    .map((row) => ({
      ...row,
      // Never show "2 of 1": a pick counts as available.
      available: Math.max(row.available, row.total),
      tag: row.total === 0 ? ('NOT_PICKED' as const) : row.total >= 2 && row.total > average * 1.25 ? ('ABOVE_AVERAGE' as const) : null,
    }))
    .sort((a, b) => b.total - a.total || b.playing - a.playing || a.name.localeCompare(b.name))

  return {
    rows,
    average,
    scale: Math.max(1, ...rows.map((row) => row.total)),
    notPicked: rows.filter((row) => row.total === 0).length,
    games: counted.size,
  }
}
