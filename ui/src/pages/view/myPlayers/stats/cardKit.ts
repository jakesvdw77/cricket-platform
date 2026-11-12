import type { StatsBasis } from '../../../../components/StatsCards'
import type { MyStatsDto } from '../../../../api/meStatsApi'

// docs/specs/147: the little pure helpers several My stats cards share (coverage lines and the truncated-history note). No React, no figure
// is worked out here: they pick server values and join words.

// "Based on N of M results": N the results that have this kind of scorecard captured, M the results in scope.
export const battingBasis = (p: MyStatsDto): StatsBasis => ({ counted: p.basis.resultsWithBattingCard, total: p.basis.resultsCounted })
export const bowlingBasis = (p: MyStatsDto): StatsBasis => ({ counted: p.basis.resultsWithBowlingCard, total: p.basis.resultsCounted })
export const fieldingBasis = (p: MyStatsDto): StatsBasis => ({ counted: p.basis.resultsWithFieldingCard, total: p.basis.resultsCounted })

// The per-match history blocks cover the newest `historyCap` matches only when the player has more (basis.truncated).
export const truncatedNote = (p: MyStatsDto): string => `Covers the newest ${p.basis.historyCap} matches only.`

// "against Rovers"; a derby or an unnamed opponent reads "against the opposition".
export const againstText = (opponent: string | null | undefined): string => (opponent ? `against ${opponent}` : 'against the opposition')
