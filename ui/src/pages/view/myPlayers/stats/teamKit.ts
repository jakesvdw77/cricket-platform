import type { ChipTone } from './cardParts'
import type { BarRow } from '../../../../components/StatsDrawings'
import type { MyTeamResultCode, MyTeamResultPoint, MyTeamShareLine, MyTeamStatsDto } from '../../../../api/meStatsApi'
import { STATS_COLOUR } from '../../../../brandTokens'
import { dayText, formatPercent } from './statsFormat'

// docs/specs/147: the little pure helpers the Team stats cards share. No React, no figure is worked out here: they pick server values and
// join words.

export const RESULT_LETTER: Record<MyTeamResultCode, string> = { WON: 'W', LOST: 'L', TIED: 'T', DRAWN: 'D', NO_RESULT: 'NR' }
export const RESULT_WORD: Record<MyTeamResultCode, string> = { WON: 'won', LOST: 'lost', TIED: 'tied', DRAWN: 'drawn', NO_RESULT: 'no result' }

export const resultTone = (result: MyTeamResultCode): ChipTone => (result === 'WON' ? 'win' : result === 'LOST' ? 'loss' : 'neutral')

// The history blocks cover the newest `historyCap` results only when the team has more (basis.truncated).
export const truncatedTeamNote = (p: MyTeamStatsDto): string => `Covers the newest ${p.basis.historyCap} results only.`

// A bar label is the full name: the label column wraps to two lines before it is cut, and the full text is its title (owner, 2026-11-07).
export const shortLabel = (line: MyTeamShareLine): string => line.label

// "26%" from the server's share, or the plain value when no share was sent.
export const shareText = (line: MyTeamShareLine): string => (line.sharePercent === null ? String(line.value) : formatPercent(line.sharePercent, 0))

// Intelligent colour for a result-based column or bar: win green, loss coral, anything else the neutral sand.
export const resultColour = (result: MyTeamResultCode): string => (result === 'WON' ? STATS_COLOUR.good : result === 'LOST' ? STATS_COLOUR.bad : STATS_COLOUR.bar)

// "1 Nov v Rovers": a match as a row label.
export const matchLabel = (point: { matchDate: string | null; opponentName: string | null }): string =>
  `${dayText(point.matchDate)}${point.opponentName ? ` v ${point.opponentName}` : ''}`

// The results with a recorded scorecard, newest first (series.results is oldest first).
export const newestFirst = (p: MyTeamStatsDto): MyTeamResultPoint[] => [...p.series.results].reverse()

// Bars of one server figure per match, newest first: the Summary cards' front (matches with no such figure, forfeits for one, are left out).
export function matchBars(p: MyTeamStatsDto, pick: (point: MyTeamResultPoint) => number | null): BarRow[] {
  return newestFirst(p).flatMap((point, index) => {
    const value = pick(point)
    return value === null ? [] : [{ key: `${point.matchId}-${index}`, label: matchLabel(point), value, valueLabel: String(value) }]
  })
}

// A venue name for a bar tag is "Home" for the home ground only.
export const homeTag = (home: boolean | null): string | undefined => (home === true ? 'Home' : undefined)
