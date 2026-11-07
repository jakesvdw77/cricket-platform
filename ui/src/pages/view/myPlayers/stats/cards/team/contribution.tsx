import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamShareBlock, MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { DASH, formatCount, formatPercent } from '../../statsFormat'
import { shareText, shortLabel } from '../../teamKit'

// docs/specs/147 section 5, team.contribution: where the runs come from (front, by player: the top five, Others, Extras) and where the
// wickets come from (back, by bowler). Guests are one line. The back's table carries both drawings' values, with full names.
// Source: contribution.runs, contribution.wickets.
const rowsOf = (block: MyTeamShareBlock) =>
  block.lines.map((line, index) => ({ key: `${line.kind}-${line.label}-${index}`, label: shortLabel(line), value: line.value, valueLabel: shareText(line) }))

const altOf = (name: string, block: MyTeamShareBlock) =>
  `${name}: ${block.lines.map((line) => `${line.label} ${line.value}${line.sharePercent === null ? '' : ` (${formatPercent(line.sharePercent, 0)})`}`).join(', ')}.`

export const teamContribution: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.contribution',
  page: 'team',
  group: 'contribution',
  title: () => 'Where the runs come from',
  tag: 'HAVE',
  needs: ['contribution', 'basis'],
  order: 10,
  whenMissing: 'hide',
  emptyText: 'No scorecards yet.',
  state: (p) => {
    const { runs, wickets } = p.contribution
    if (runs.total === null && wickets.total === null) return 'empty'
    return runs.inningsWithCard < runs.inningsCounted || wickets.inningsWithCard < wickets.inningsCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Batting cards are in ${p.contribution.runs.inningsWithCard} of ${p.contribution.runs.inningsCounted} innings, bowling cards in ${p.contribution.wickets.inningsWithCard} of ${p.contribution.wickets.inningsCounted}.`,
  summary: (p) => `Where ${p.teamName}'s runs and wickets come from, by player.`,
  Front: ({ payload: p }) => {
    const { runs } = p.contribution
    return (
      <>
        <Cap>Runs by player</Cap>
        {runs.lines.length > 0 ? (
          <HorizontalBars rows={rowsOf(runs)} max={runs.total ?? undefined} alt={altOf('Runs by player', runs)} />
        ) : (
          <Note>No batting cards yet.</Note>
        )}
        <Note>{runs.total === null ? 'No runs recorded yet.' : `${runs.total} runs in ${runs.inningsWithCard} of ${runs.inningsCounted} innings with a batting card.`}</Note>
      </>
    )
  },
  Back: ({ payload: p }) => {
    const { runs, wickets } = p.contribution
    // One table for both drawings: a line (a player, Guests, Others, Extras) with its runs and its wickets.
    const merged = new Map<string, { label: string; runs: number | null; wickets: number | null }>()
    for (const line of runs.lines) merged.set(`${line.kind}|${line.label}`, { label: line.label, runs: line.value, wickets: null })
    for (const line of wickets.lines) {
      const key = `${line.kind}|${line.label}`
      const found = merged.get(key)
      if (found) found.wickets = line.value
      else merged.set(key, { label: line.label, runs: null, wickets: line.value })
    }
    return (
      <>
        <Cap>Wickets by bowler</Cap>
        {wickets.lines.length > 0 ? (
          <HorizontalBars rows={rowsOf(wickets)} max={wickets.total ?? undefined} alt={altOf('Wickets by bowler', wickets)} />
        ) : (
          <Note>No bowling cards yet.</Note>
        )}
        <FaceTable
          label="Runs and wickets by player"
          heads={['Player', 'Runs', 'Wkts']}
          rows={[...merged.entries()].map(([key, row]) => ({ key, cells: [row.label, formatCount(row.runs), formatCount(row.wickets)] }))}
        />
        <Note>
          {wickets.total === null ? DASH : `${wickets.total} wickets`}
          {' '}in {wickets.inningsWithCard} of {wickets.inningsCounted} innings with a bowling card.
        </Note>
      </>
    )
  },
}
