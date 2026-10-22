import { DashboardCard } from '../../../../components/DashboardCard'
import { DonutChart } from '../../../../components/charts/DonutChart'
import type { CategoryStyle } from '../../../../components/charts/chartStyles'
import type { TeamCardProps } from './teamDashboardParts'

// Won success, Lost error, Tied info, Drawn warning, No result neutral; each also has its own pattern.
const STYLES: Record<'won' | 'lost' | 'tied' | 'drawn' | 'noResult', CategoryStyle> = {
  won: { tone: 'success', pattern: 'solid' },
  lost: { tone: 'error', pattern: 'diagonal' },
  tied: { tone: 'info', pattern: 'dots' },
  drawn: { tone: 'warning', pattern: 'vertical' },
  noResult: { tone: 'grey', pattern: 'solid' },
}

// docs/specs/117-stats-dashboard.md (chart 7): Results, a donut of the team's results with the total played in the centre. Counts are the
// server's (equal to the Played, Won, Lost tiles); a forfeit is a win or a loss as the record counts it.
export function ResultsCard({ data, dimmed }: Pick<TeamCardProps, 'data' | 'dimmed'>) {
  const summary = data.resultsSummary
  const rows = [
    { key: 'won', label: 'Won', value: summary.won },
    { key: 'lost', label: 'Lost', value: summary.lost },
    { key: 'tied', label: 'Tied', value: summary.tied },
    { key: 'drawn', label: 'Drawn', value: summary.drawn },
    { key: 'noResult', label: 'No result', value: summary.noResult },
  ] as const

  return (
    <DashboardCard
      testId="results"
      title="Results"
      dimmed={dimmed}
      chartArea="auto"
      empty={summary.played === 0 ? { title: 'No results to show', description: 'No counted results in these matches.' } : null}
      description={`${summary.played} played: ${rows.map((row) => `${row.label.toLowerCase()} ${row.value}`).join(', ')}.`}
      coverage={summary.forfeits > 0 ? `Includes ${summary.forfeits} ${summary.forfeits === 1 ? 'forfeit' : 'forfeits'}, counted as a win or a loss as in the record.` : 'Forfeits are counted as a win or a loss, as in the record.'}
      table={{
        caption: 'Results',
        columns: [
          { key: 'outcome', label: 'Outcome' },
          { key: 'count', label: 'Results', align: 'right' },
        ],
        rows: [...rows.map((row) => ({ key: row.key, cells: [row.label, String(row.value)] })), { key: 'total', total: true, cells: ['Played', String(summary.played)] }],
      }}
    >
      <DonutChart slices={rows.map((row) => ({ key: row.key, label: row.label, value: row.value, style: STYLES[row.key] }))} centerValue={String(summary.played)} centerLabel="played" />
    </DashboardCard>
  )
}
