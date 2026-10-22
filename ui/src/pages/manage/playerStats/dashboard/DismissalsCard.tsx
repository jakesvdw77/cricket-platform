import { DashboardCard } from '../../../../components/DashboardCard'
import { DonutChart } from '../../../../components/charts/DonutChart'
import { CATEGORY_STYLES } from '../../../../components/charts/chartStyles'
import type { CategoryStyle } from '../../../../components/charts/chartStyles'
import type { PlayerCardProps } from './RunsPerInningsCard'
import { percentText } from './dashboardFormat'

// A not-out innings carries the same hatch as the not-out bars of Runs per innings; every other type takes the next pattern in order.
const NOT_OUT_STYLE: CategoryStyle = { tone: 'primary', pattern: 'diagonal' }

// docs/specs/117-stats-dashboard.md (chart 2, decision 19): How you were dismissed, Batting, half width. A donut of the player's own
// batting dismissals plus not out, total innings in the centre; the table column is "Dismissals". Counts and shares are the server's.
export function DismissalsCard({ data, dimmed }: Pick<PlayerCardProps, 'data' | 'dimmed'>) {
  const { dismissals, battingSummary: summary, basis } = data
  const total = summary.inningsTotal

  let empty: { title: string; description?: string } | null = null
  if (dismissals.length === 0) {
    empty =
      basis.resultsWithBattingCard === 0
        ? { title: 'No batting cards captured', description: 'The dismissals chart needs a scorecard with dismissals. Other charts that do not need one still show.' }
        : { title: 'No innings to show', description: 'This player did not bat in these matches.' }
  }

  let order = 0
  const slices = dismissals.map((entry) => {
    const style = entry.type === 'NOT_OUT' ? NOT_OUT_STYLE : CATEGORY_STYLES[1 + (order++ % (CATEGORY_STYLES.length - 1))]
    return { key: entry.type, label: entry.label, value: entry.count, percentText: percentText(entry.percent), style }
  })

  return (
    <DashboardCard
      testId="dismissals"
      title="How you were dismissed"
      subtitle="Batting"
      dimmed={dimmed}
      empty={empty}
      chartArea="auto"
      description={`${total} innings: ${dismissals.map((entry) => `${entry.label} ${entry.count}`).join(', ')}.`}
      coverage={data.truncated ? 'Covers the newest innings only; the Runs tile counts all.' : null}
      table={{
        caption: 'How the player was dismissed',
        columns: [
          { key: 'type', label: 'How out' },
          { key: 'count', label: 'Dismissals', align: 'right' },
          { key: 'share', label: 'Share', align: 'right' },
        ],
        rows: [
          ...dismissals.map((entry) => ({ key: entry.type, cells: [entry.label, String(entry.count), percentText(entry.percent)] })),
          ...(data.truncated ? [] : [{ key: 'total', total: true, cells: ['Total innings', String(total), ''] }]),
        ],
      }}
    >
      <DonutChart slices={slices} centerValue={String(total)} centerLabel="innings" />
    </DashboardCard>
  )
}
