import { useState } from 'react'
import { Box, ToggleButton } from '@mui/material'
import { DashboardCard } from '../../../../components/DashboardCard'
import { CompactToggleGroup } from '../../../../components/CompactToggleGroup'
import { LineSeriesChart } from '../../../../components/charts/LineSeriesChart'
import { ChartLegend } from '../../../../components/charts/ChartLegend'
import { formatInstantDate } from '../../../../utils/formatInstantDate'
import type { PlayerCardProps } from './RunsPerInningsCard'
import { DashboardResultLink } from './DashboardResultLink'
import { NOT_RECORDED, matchTitle, opponentText } from './dashboardFormat'

type Mode = 'average' | 'runs'

// docs/specs/117-stats-dashboard.md (chart 3): Batting trend, Batting, half width. A line over every counted innings, one measure at
// a time (an Average | Runs switch, never two scales): the running batting average after each innings (a gap before the first
// dismissal) or the cumulative runs, which end at the Runs tile. Values are the server's running totals.
export function BattingTrendCard({ data, backTo, dimmed }: PlayerCardProps) {
  const [mode, setMode] = useState<Mode>('average')
  const { battingTrend: points, battingSummary: summary, basis } = data
  const last = points[points.length - 1]

  let empty: { title: string; description?: string } | null = null
  if (points.length === 0) {
    empty =
      basis.resultsWithBattingCard === 0
        ? { title: 'No batting cards captured', description: 'The trend needs a scorecard with a batting card.' }
        : { title: 'No innings to show', description: 'This player did not bat in these matches.' }
  }

  const labels = points.map((_, index) => String(index + 1))
  const values = points.map((point) => (mode === 'average' ? point.average : point.cumulativeRuns))
  const fewPoints = points.length <= 12
  const text = (value: number | null) => (value === null ? null : mode === 'average' ? value.toFixed(2) : String(value))
  const average = summary.averageRuns

  return (
    <DashboardCard
      testId="batting-trend"
      title="Batting trend"
      subtitle="Batting"
      dimmed={dimmed}
      empty={empty}
      description={last ? `After ${points.length} innings: ${last.average === null ? 'no average yet' : `average ${last.average.toFixed(2)}`}, ${last.cumulativeRuns} runs.` : undefined}
      coverage={data.truncated && data.truncatedSince ? `Since ${formatInstantDate(data.truncatedSince)}.` : null}
      table={{
        caption: 'Running average and runs after each innings, oldest first',
        columns: [
          { key: 'innings', label: 'Innings', align: 'right' },
          { key: 'date', label: 'Date' },
          { key: 'opponent', label: 'Opponent' },
          { key: 'average', label: 'Average', align: 'right' },
          { key: 'runs', label: 'Runs', align: 'right' },
          { key: 'dismissals', label: 'Dismissals', align: 'right' },
        ],
        rows: points.map((point, index) => ({
          key: `${point.resultId}-${index}`,
          cells: [
            String(index + 1),
            <DashboardResultLink key="d" matchId={point.matchId} label={formatInstantDate(point.matchDate)} backTo={backTo} backLabel="Dashboard" />,
            opponentText(point.opponentName, point.derby),
            point.average === null ? NOT_RECORDED : point.average.toFixed(2),
            String(point.cumulativeRuns),
            String(point.cumulativeDismissals),
          ],
        })),
      }}
      note={mode === 'average' ? 'Running average (runs per dismissal)' : 'Cumulative runs'}
      legend={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ maxWidth: 240 }}>
            <CompactToggleGroup<Mode> value={mode} onChange={setMode} ariaLabel="Batting trend measure" fullWidth>
              <ToggleButton value="average" aria-label="Average">
                Average
              </ToggleButton>
              <ToggleButton value="runs" aria-label="Runs">
                Runs
              </ToggleButton>
            </CompactToggleGroup>
          </Box>
          <ChartLegend
            label="Batting trend"
            items={[
              { key: 'series', label: mode === 'average' ? 'Running average' : 'Cumulative runs', line: { tone: 'primary', marker: 'circle' } },
              ...(mode === 'average' && average !== null ? [{ key: 'average', label: `Overall average ${average.toFixed(2)}`, line: { tone: 'grey' as const, dashed: true } }] : []),
            ]}
          />
        </Box>
      }
    >
      <LineSeriesChart
        labels={labels}
        markGaps={false}
        series={[{ key: mode, label: mode === 'average' ? 'Running average' : 'Cumulative runs', tone: 'primary', marker: 'circle', values, pointTexts: fewPoints ? values.map(text) : undefined }]}
        referenceValue={mode === 'average' ? average : null}
        referenceLabel={average === null ? undefined : `Average ${average.toFixed(2)}`}
        tooltip={(index) => {
          const point = points[index]
          if (!point) return null
          return {
            title: `Innings ${index + 1} · ${matchTitle(point.matchDate, point.opponentName, point.derby)}`,
            rows: [
              { label: 'Average', value: point.average === null ? NOT_RECORDED : point.average.toFixed(2) },
              { label: 'Runs', value: String(point.cumulativeRuns) },
              { label: 'Dismissals', value: String(point.cumulativeDismissals) },
            ],
          }
        }}
      />
    </DashboardCard>
  )
}
