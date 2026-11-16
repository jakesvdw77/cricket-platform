import type { Match } from '../api/matchApi'

// docs/specs/155-playoff-and-knockout-fixtures.md: the general list of stages to pick from. A stage is free text; any other text
// is allowed. An empty stage means a pool match.
export const STAGE_SUGGESTIONS = ['Playoff', 'Quarter-final', 'Semi-final', 'Third place', 'Final'] as const

// The stage a match shows as a chip, or null for a pool match.
export const stageOf = (match: Pick<Match, 'stage'>): string | null => match.stage?.trim() || null

// A TBC side reads "TBC: 3rd in the pool".
export const tbcText = (name: string | null | undefined): string => `TBC: ${name ?? ''}`.trim()

// The distinct stages in use among matches, in first-seen order, for the schedule's Stage filter.
export function stagesIn(matches: Array<Pick<Match, 'stage'>>): string[] {
  const seen: string[] = []
  for (const match of matches) {
    const stage = stageOf(match)
    if (stage && !seen.includes(stage)) seen.push(stage)
  }
  return seen
}
