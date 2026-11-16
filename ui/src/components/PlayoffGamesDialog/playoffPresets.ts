// docs/specs/155-playoff-and-knockout-fixtures.md: the rows of the Add Playoff Games table and the two presets that fill it.

// One side of a row: a TBC text, one of our teams, or a league team.
export interface PlayoffSideValue {
  kind: 'tbc' | 'team' | 'leagueTeam'
  // The TBC text when kind is 'tbc'.
  text: string
  // The team or league team id otherwise.
  id: string
}

export interface PlayoffRow {
  key: string
  // Empty means the dialog's round stage.
  stage: string
  label: string
  home: PlayoffSideValue
  away: PlayoffSideValue
  // 'YYYY-MM-DDTHH:mm' (the DateTimeField value) or ''.
  matchDate: string
  field: { id: string; name: string; verificationStatus: null } | null
}

// 1st, 2nd, 3rd, 4th, 11th, 21st...
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  const suffix = ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${suffix}`
}

export const tbcSide = (text: string): PlayoffSideValue => ({ kind: 'tbc', text, id: '' })

let counter = 0
export const newRowKey = (): string => `row-${(counter += 1)}`

export function emptyRow(stage = ''): PlayoffRow {
  return { key: newRowKey(), stage, label: '', home: tbcSide(''), away: tbcSide(''), matchDate: '', field: null }
}

// 1st v 2nd, 3rd v 4th and so on for a league of `teamCount` teams: one game per finishing pair.
export function pairingRows(teamCount: number, stage: string): PlayoffRow[] {
  const pairs = Math.max(1, Math.floor(teamCount / 2))
  return Array.from({ length: pairs }, (_, index) => {
    const first = index * 2 + 1
    const second = first + 1
    return {
      ...emptyRow(stage),
      label: `${ordinal(first)} v ${ordinal(second)}`,
      home: tbcSide(`${ordinal(first)} in the pool`),
      away: tbcSide(`${ordinal(second)} in the pool`),
    }
  })
}

// Two semi-finals (1st v 4th, 2nd v 3rd) and the final between their winners.
export function semiFinalRows(): PlayoffRow[] {
  return [
    { ...emptyRow('Semi-final'), label: 'Semi-final 1', home: tbcSide('1st in the pool'), away: tbcSide('4th in the pool') },
    { ...emptyRow('Semi-final'), label: 'Semi-final 2', home: tbcSide('2nd in the pool'), away: tbcSide('3rd in the pool') },
    { ...emptyRow('Final'), label: 'Final', home: tbcSide('Winner of semi-final 1'), away: tbcSide('Winner of semi-final 2') },
  ]
}
