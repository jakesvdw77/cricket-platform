import type { ChipTone } from './cardParts'
import type { MyTeamResultCode, MyTeamShareLine, MyTeamStatsDto } from '../../../../api/meStatsApi'
import { formatPercent } from './statsFormat'

// docs/specs/147: the little pure helpers the Team stats cards share. No React, no figure is worked out here: they pick server values and
// join words.

export const RESULT_LETTER: Record<MyTeamResultCode, string> = { WON: 'W', LOST: 'L', TIED: 'T', DRAWN: 'D', NO_RESULT: 'NR' }
export const RESULT_WORD: Record<MyTeamResultCode, string> = { WON: 'won', LOST: 'lost', TIED: 'tied', DRAWN: 'drawn', NO_RESULT: 'no result' }

export const resultTone = (result: MyTeamResultCode): ChipTone => (result === 'WON' ? 'win' : result === 'LOST' ? 'loss' : 'neutral')

// The history blocks cover the newest `historyCap` results only when the team has more (basis.truncated).
export const truncatedTeamNote = (p: MyTeamStatsDto): string => `Covers the newest ${p.basis.historyCap} results only.`

// "Anton" from "Anton Smit": a bar label has little room, the table beside it carries the full name.
export const shortLabel = (line: MyTeamShareLine): string => (line.kind === 'PLAYER' ? (line.label.trim().split(/\s+/)[0] ?? line.label) : line.label)

// "26%" from the server's share, or the plain value when no share was sent.
export const shareText = (line: MyTeamShareLine): string => (line.sharePercent === null ? String(line.value) : formatPercent(line.sharePercent, 0))
