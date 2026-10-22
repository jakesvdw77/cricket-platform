import { DashboardCard } from '../../../../components/DashboardCard'
import { StackedBarChart } from '../../../../components/charts/StackedBarChart'
import { ChartLegend } from '../../../../components/charts/ChartLegend'
import { CATEGORY_STYLES, NOT_ITEMISED_STYLE } from '../../../../components/charts/chartStyles'
import { formatInstantDate } from '../../../../utils/formatInstantDate'
import { DashboardResultLink } from '../../playerStats/dashboard/DashboardResultLink'
import { NOT_RECORDED, matchTitle, opponentText, shortDate, windowCaption } from '../../playerStats/dashboard/dashboardFormat'
import type { TeamCardProps } from './teamDashboardParts'

const CATEGORIES = [
  { key: 'wides', label: 'Wides', style: CATEGORY_STYLES[1] },
  { key: 'noBalls', label: 'No-balls', style: CATEGORY_STYLES[2] },
  { key: 'byes', label: 'Byes', style: CATEGORY_STYLES[3] },
  { key: 'legByes', label: 'Leg-byes', style: CATEGORY_STYLES[4] },
  { key: 'penaltyRuns', label: 'Penalty', style: CATEGORY_STYLES[5] },
  { key: 'notItemised', label: 'Not itemised', style: NOT_ITEMISED_STYLE },
] as const

// docs/specs/117-stats-dashboard.md (chart 10, decision 15a): Extras conceded, a stacked bar per match, last 30, a pattern per type and a
// grey Not itemised bar for a total-only match; a match with no extras recorded is a gap. "Lower is better". Figures are the server's.
export function ExtrasConcededCard({ data, backTo, dimmed }: TeamCardProps) {
  const points = data.extrasConceded
  const summary = data.extrasSummary
  const complete = summary.matchesWithExtras >= summary.matchesCounted && summary.matchesItemised >= summary.matchesWithExtras
  const recordedCaption = complete
    ? null
    : `Extras recorded for ${summary.matchesWithExtras} of ${summary.matchesCounted} matches${summary.matchesItemised !== summary.matchesWithExtras ? `, itemised for ${summary.matchesItemised}` : ''}.`
  const cell = (value: number | null) => (value === null ? NOT_RECORDED : String(value))

  return (
    <DashboardCard
      testId="extras-conceded"
      title="Extras conceded"
      dimmed={dimmed}
      empty={summary.matchesWithExtras === 0 ? { title: 'No extras have been recorded for these matches.', description: 'Extras are entered on the bowling card of a result.' } : null}
      note="Lower is better"
      description={`Extras recorded for ${summary.matchesWithExtras} of ${summary.matchesCounted} matches.`}
      coverage={[recordedCaption, windowCaption(points.length, summary.totalPoints, 'matches', 'Extras')].filter(Boolean).join(' ') || null}
      legend={<ChartLegend label="Extras types" items={CATEGORIES.map((category) => ({ key: category.key, label: category.label, style: category.style }))} />}
      table={{
        caption: 'Extras conceded per match, oldest first',
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'opponent', label: 'Opponent' },
          { key: 'wides', label: 'Wides', align: 'right' },
          { key: 'noBalls', label: 'No-balls', align: 'right' },
          { key: 'byes', label: 'Byes', align: 'right' },
          { key: 'legByes', label: 'Leg-byes', align: 'right' },
          { key: 'penalty', label: 'Penalty', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
        ],
        rows: points.map((point, index) => ({
          key: `${point.resultId}-${index}`,
          cells: [
            <DashboardResultLink key="d" matchId={point.matchId} label={formatInstantDate(point.matchDate)} backTo={backTo} backLabel="Team" />,
            opponentText(point.opponentName, point.derby),
            cell(point.wides),
            cell(point.noBalls),
            cell(point.byes),
            cell(point.legByes),
            cell(point.penaltyRuns),
            point.total === null ? NOT_RECORDED : point.notItemised !== null ? `${point.total} (Not itemised)` : String(point.total),
          ],
        })),
      }}
    >
      <StackedBarChart
        labels={points.map((point) => shortDate(point.matchDate))}
        categories={CATEGORIES.map((category) => ({ key: category.key, label: category.label, style: category.style }))}
        values={CATEGORIES.map((category) => points.map((point) => point[category.key]))}
        totals={points.map((point) => point.total)}
        tooltip={(index) => {
          const point = points[index]
          if (!point) return null
          return {
            title: matchTitle(point.matchDate, point.opponentName, point.derby),
            rows: [
              { label: 'Total extras', value: cell(point.total) },
              ...CATEGORIES.flatMap((category) => (point[category.key] === null ? [] : [{ label: category.label, value: String(point[category.key]), style: category.style }])),
            ],
          }
        }}
      />
    </DashboardCard>
  )
}
