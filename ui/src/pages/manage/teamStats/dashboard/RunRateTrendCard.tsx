import { DashboardCard } from '../../../../components/DashboardCard'
import { LineSeriesChart } from '../../../../components/charts/LineSeriesChart'
import type { LineSeriesDef } from '../../../../components/charts/LineSeriesChart'
import { ChartLegend } from '../../../../components/charts/ChartLegend'
import { formatInstantDate } from '../../../../utils/formatInstantDate'
import { DashboardResultLink } from '../../results/DashboardResultLink'
import { NOT_RECORDED, matchTitle, opponentText, shortDate } from '../../../../utils/dashboardFormat'
import { netRunRateReason, netRunRateText, rateText } from '../../leaderboards/teamStatsFormat'
import type { TeamCardProps } from './teamDashboardParts'

// docs/specs/117-stats-dashboard.md (chart 9): Run rate trend, full width. The running team and opposition run rates after each result with
// balls; net run rate is a third line only when its status is SHOWN, otherwise the reason is the caption. Values are the server's.
export function RunRateTrendCard({ data, backTo, dimmed }: TeamCardProps) {
  const points = data.runRateTrend
  const net = data.netRunRateTrend
  const netShown = net.status === 'SHOWN' && (net.points?.length ?? 0) > 0
  // net run rate points are matched to the run rate points by result, never recomputed
  const netByResult = new Map((net.points ?? []).map((point) => [point.resultId, point.value]))
  const netValues = points.map((point) => (netByResult.has(point.resultId) ? (netByResult.get(point.resultId) ?? null) : null))
  const reason = net.status === 'SHOWN' ? null : netRunRateReason({ value: null, status: net.status })

  const series: LineSeriesDef[] = [
    { key: 'team', label: 'Team run rate', tone: 'primary', marker: 'circle', values: points.map((point) => point.teamRunRate) },
    { key: 'opposition', label: 'Opposition run rate', tone: 'error', marker: 'square', dashed: true, values: points.map((point) => point.oppositionRunRate) },
  ]

  return (
    <DashboardCard
      testId="run-rate-trend"
      title="Run rate trend"
      fullWidth
      dimmed={dimmed}
      empty={points.length === 0 ? { title: 'No run rate to show', description: 'Run rate needs results with the innings and balls recorded.' } : null}
      description={`Running run rate after ${points.length} ${points.length === 1 ? 'result' : 'results'}.`}
      coverage={reason}
      legend={
        <ChartLegend
          label="Run rate trend"
          items={[
            { key: 'team', label: 'Team run rate', line: { tone: 'primary', marker: 'circle' } },
            { key: 'opposition', label: 'Opposition run rate', line: { tone: 'error', marker: 'square', dashed: true } },
            ...(netShown ? [{ key: 'net', label: 'Net run rate', line: { tone: 'info' as const, marker: 'diamond' as const } }] : []),
          ]}
        />
      }
      table={{
        caption: 'Running run rates after each result, oldest first',
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'opponent', label: 'Opponent' },
          { key: 'team', label: 'Team', align: 'right' },
          { key: 'opposition', label: 'Opposition', align: 'right' },
          ...(netShown ? [{ key: 'net', label: 'Net run rate', align: 'right' as const }] : []),
        ],
        rows: points.map((point, index) => ({
          key: `${point.resultId}-${index}`,
          cells: [
            <DashboardResultLink key="d" matchId={point.matchId} label={formatInstantDate(point.matchDate)} backTo={backTo} backLabel="Team" />,
            opponentText(point.opponentName, false),
            point.teamRunRate === null ? NOT_RECORDED : rateText(point.teamRunRate),
            point.oppositionRunRate === null ? NOT_RECORDED : rateText(point.oppositionRunRate),
            ...(netShown ? [netValues[index] === null ? NOT_RECORDED : netRunRateText(netValues[index])] : []),
          ],
        })),
      }}
    >
      <LineSeriesChart
        labels={points.map((point) => shortDate(point.matchDate))}
        markGaps={false}
        series={netShown ? [...series, { key: 'net', label: 'Net run rate', tone: 'info', marker: 'diamond', values: netValues }] : series}
        tooltip={(index) => {
          const point = points[index]
          if (!point) return null
          return {
            title: matchTitle(point.matchDate, point.opponentName, false),
            rows: [
              { label: 'Team', value: point.teamRunRate === null ? NOT_RECORDED : rateText(point.teamRunRate) },
              { label: 'Opposition', value: point.oppositionRunRate === null ? NOT_RECORDED : rateText(point.oppositionRunRate) },
              ...(netShown ? [{ label: 'Net run rate', value: netValues[index] === null ? NOT_RECORDED : netRunRateText(netValues[index]) }] : []),
            ],
          }
        }}
      />
    </DashboardCard>
  )
}
