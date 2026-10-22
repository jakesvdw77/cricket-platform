import { DashboardCard } from '../../../../components/DashboardCard'
import { DonutChart } from '../../../../components/charts/DonutChart'
import { CATEGORY_STYLES, NOT_ITEMISED_STYLE } from '../../../../components/charts/chartStyles'
import type { PlayerCardProps } from './RunsPerInningsCard'
import { percentText } from './dashboardFormat'

// docs/specs/117-stats-dashboard.md (chart 5, decision 19): Wickets by type, Bowling, half width. A donut of the player's own wickets by
// dismissal type with the total in the centre and a grey "Not itemised" remainder; types plus Not itemised equal the Wickets tile.
// Counts, shares, the total and the coverage are the server's.
export function WicketsByTypeCard({ data, dimmed }: Pick<PlayerCardProps, 'data' | 'dimmed'>) {
  const { wicketTypes: wickets, basis } = data
  const { coverage } = wickets

  let empty: { title: string; description?: string } | null = null
  if (wickets.total === 0) {
    empty =
      basis.resultsWithBowlingCard === 0
        ? { title: 'No bowling cards captured', description: 'No bowling scorecard was captured for these matches.' }
        : { title: 'No wickets taken', description: 'No wickets taken in these matches.' }
  }

  const slices = [
    ...wickets.types
      .filter((entry) => entry.count > 0)
      .map((entry, index) => ({ key: entry.type, label: entry.label, value: entry.count, percentText: percentText(entry.percent), style: CATEGORY_STYLES[index % CATEGORY_STYLES.length] })),
    ...(wickets.notItemised.count > 0 ? [{ key: 'notItemised', label: 'Not itemised', value: wickets.notItemised.count, percentText: percentText(wickets.notItemised.percent), style: NOT_ITEMISED_STYLE }] : []),
  ]
  const partly = wickets.itemised < wickets.total

  return (
    <DashboardCard
      testId="wickets-by-type"
      title="Wickets by type"
      subtitle="Bowling"
      dimmed={dimmed}
      empty={empty}
      chartArea="auto"
      description={`${wickets.total} ${wickets.total === 1 ? 'wicket' : 'wickets'}, ${wickets.itemised} itemised by dismissal type.`}
      coverage={partly ? `${coverage.wicketsItemised} of ${coverage.wicketsTotal} wickets itemised.` : null}
      footer={
        wickets.itemised === 0 && wickets.total > 0
          ? "The opposition's batting cards do not name the bowler, so no wicket could be itemised."
          : partly
            ? 'Wickets without a dismissal type are shown in grey, never spread across the other types.'
            : undefined
      }
      table={{
        caption: "The player's wickets by dismissal type",
        columns: [
          { key: 'type', label: 'Dismissal type' },
          { key: 'wickets', label: 'Wickets', align: 'right' },
          { key: 'share', label: 'Share', align: 'right' },
        ],
        rows: [
          ...wickets.types.filter((entry) => entry.count > 0).map((entry) => ({ key: entry.type, cells: [entry.label, String(entry.count), percentText(entry.percent)] })),
          { key: 'notItemised', cells: ['Not itemised', String(wickets.notItemised.count), percentText(wickets.notItemised.percent)] },
          { key: 'total', total: true, cells: ['Total', String(wickets.total), ''] },
        ],
      }}
    >
      <DonutChart slices={slices} centerValue={String(wickets.total)} centerLabel={wickets.total === 1 ? 'wicket' : 'wickets'} />
    </DashboardCard>
  )
}
