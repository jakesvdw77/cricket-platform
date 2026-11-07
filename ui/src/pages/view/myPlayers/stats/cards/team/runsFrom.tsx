import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { formatPercent } from '../../statsFormat'
import { shareText, shortLabel } from '../../teamKit'

// docs/specs/147 Amendment 3, team.runs-from: where the runs come from (top scorers, Others, Extras, as neutral sand bars). Back: every
// line as a table with its share. Source: contribution.runs.
const SHOWN = 5

export const teamRunsFrom: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.runs-from',
  page: 'team',
  group: 'batting',
  title: () => 'Where The Runs Come From',
  tag: 'PARTLY',
  needs: ['contribution', 'basis'],
  order: 50,
  whenMissing: 'hide',
  emptyText: 'No batting cards yet.',
  basis: (p) => ({ counted: p.contribution.runs.inningsWithCard, total: p.contribution.runs.inningsCounted }),
  state: (p) => {
    if (p.contribution.runs.total === null || p.contribution.runs.lines.length === 0) return 'empty'
    return p.contribution.runs.inningsWithCard < p.contribution.runs.inningsCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Batting cards are in ${p.contribution.runs.inningsWithCard} of ${p.contribution.runs.inningsCounted} innings.`,
  summary: (p) => `Where ${p.teamName}'s runs come from, by player.`,
  Front: ({ payload: p }) => {
    const lines = p.contribution.runs.lines
    return (
      <>
        <HorizontalBars
          rows={lines.slice(0, SHOWN).map((line, index) => ({ key: `${line.kind}-${line.label}-${index}`, label: shortLabel(line), value: line.value, valueLabel: shareText(line) }))}
          max={p.contribution.runs.total ?? undefined}
          alt={`Runs by player: ${lines.map((line) => `${line.label} ${line.value}${line.sharePercent === null ? '' : ` (${formatPercent(line.sharePercent, 0)})`}`).join(', ')}.`}
        />
        <Note>{p.contribution.runs.total} runs{lines.length > SHOWN ? `, top ${SHOWN} shown. Flip for all.` : '.'}</Note>
      </>
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Runs by player</Cap>
      <FaceTable
        label="Runs by player with their share of the total"
        heads={['Player', 'Runs', 'Share']}
        rows={p.contribution.runs.lines.map((line, index) => ({
          key: `${line.kind}-${line.label}-${index}`,
          cells: [line.label, String(line.value), formatPercent(line.sharePercent, 0)],
        }))}
      />
    </>
  ),
}
