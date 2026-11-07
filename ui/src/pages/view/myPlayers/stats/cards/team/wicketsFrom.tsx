import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { formatPercent } from '../../statsFormat'
import { shareText, shortLabel } from '../../teamKit'

// docs/specs/147 Amendment 3, team.wickets-from: where the wickets come from, by bowler (neutral sand bars). Back: every line as a table with
// its share. Source: contribution.wickets.
const SHOWN = 5

export const teamWicketsFrom: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.wickets-from',
  page: 'team',
  group: 'bowling',
  title: () => 'Where The Wickets Come From',
  tag: 'PARTLY',
  needs: ['contribution', 'basis'],
  order: 40,
  whenMissing: 'hide',
  emptyText: 'No bowling cards yet.',
  basis: (p) => ({ counted: p.contribution.wickets.inningsWithCard, total: p.contribution.wickets.inningsCounted }),
  state: (p) => {
    if (p.contribution.wickets.total === null || p.contribution.wickets.lines.length === 0) return 'empty'
    return p.contribution.wickets.inningsWithCard < p.contribution.wickets.inningsCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Bowling cards are in ${p.contribution.wickets.inningsWithCard} of ${p.contribution.wickets.inningsCounted} innings.`,
  summary: (p) => `Where ${p.teamName}'s wickets come from, by bowler.`,
  Front: ({ payload: p }) => {
    const lines = p.contribution.wickets.lines
    return (
      <>
        <HorizontalBars
          rows={lines.slice(0, SHOWN).map((line, index) => ({ key: `${line.kind}-${line.label}-${index}`, label: shortLabel(line), value: line.value, valueLabel: shareText(line) }))}
          max={p.contribution.wickets.total ?? undefined}
          alt={`Wickets by bowler: ${lines.map((line) => `${line.label} ${line.value}${line.sharePercent === null ? '' : ` (${formatPercent(line.sharePercent, 0)})`}`).join(', ')}.`}
        />
        <Note>{p.contribution.wickets.total} wickets{lines.length > SHOWN ? `, top ${SHOWN} shown. Flip for all.` : '.'}</Note>
      </>
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Wickets by bowler</Cap>
      <FaceTable
        label="Wickets by bowler with their share of the total"
        heads={['Bowler', 'Wickets', 'Share']}
        rows={p.contribution.wickets.lines.map((line, index) => ({
          key: `${line.kind}-${line.label}-${index}`,
          cells: [line.label, String(line.value), formatPercent(line.sharePercent, 0)],
        }))}
      />
    </>
  ),
}
