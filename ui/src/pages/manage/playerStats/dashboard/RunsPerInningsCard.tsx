import { useState } from 'react'
import { Box } from '@mui/material'
import { DashboardCard } from '../../../../components/DashboardCard'
import { CompactSwitch } from '../../../../components/CompactSwitch'
import { BarSeriesChart } from '../../../../components/charts/BarSeriesChart'
import { ChartLegend } from '../../../../components/charts/ChartLegend'
import { formatInstantDate } from '../../../../utils/formatInstantDate'
import { NOT_ON_FILE } from '../../../../utils/playerFormat'
import type { PlayerDashboard } from '../../../../api/playerDashboardApi'
import { DashboardResultLink } from '../../results/DashboardResultLink'
import { NOT_RECORDED, labelledFigure, matchTitle, opponentText, shortDate, windowCaption } from '../../../../utils/dashboardFormat'
import { dismissalLabel } from './dismissalLabel'

export interface PlayerCardProps {
  data: PlayerDashboard
  // the stats page address (tab=dashboard) with the filters in force: the result page's Back returns here
  backTo: string
  dimmed: boolean
}

// docs/specs/117-stats-dashboard.md (chart 1): Runs per innings, Batting, full width. Bars oldest left, a not-out innings hatched and
// starred, an average line behind a switch (off by default), a table of the same innings. Every value is the server's.
export function RunsPerInningsCard({ data, backTo, dimmed }: PlayerCardProps) {
  const [showAverage, setShowAverage] = useState(false)
  const { battingInnings: innings, battingSummary: summary, basis } = data
  const average = summary.averageRuns

  let empty: { title: string; description?: string } | null = null
  if (innings.length === 0) {
    empty =
      basis.resultsWithBattingCard === 0
        ? { title: 'No batting cards captured', description: 'The runs chart needs a scorecard with a batting card.' }
        : { title: 'No innings to show', description: 'This player did not bat in these matches.' }
  }

  const star = (index: number) => (innings[index]?.notOut ? '*' : '')
  const caption = [
    windowCaption(innings.length, summary.inningsTotal, 'innings', 'Runs'),
    basis.resultsWithBattingCard < basis.matchesCounted ? `From ${basis.resultsWithBattingCard} of ${basis.matchesCounted} matches with a batting card.` : null,
  ]
    .filter(Boolean)
    .join(' ')

  const windowed = innings.length < summary.inningsTotal
  const table = {
    caption: 'Runs per innings, oldest first',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'opponent', label: 'Opponent' },
      { key: 'runs', label: 'Runs', align: 'right' as const },
      { key: 'balls', label: 'Balls', align: 'right' as const },
      { key: 'howOut', label: 'How out' },
    ],
    rows: [
      ...innings.map((entry, index) => ({
        key: `${entry.resultId}-${index}`,
        cells: [
          <DashboardResultLink key="d" matchId={entry.matchId} label={formatInstantDate(entry.matchDate)} backTo={backTo} backLabel="Overview" />,
          opponentText(entry.opponentName, entry.derby),
          entry.runs === null ? NOT_RECORDED : `${entry.runs}${star(index)}`,
          entry.balls === null ? NOT_ON_FILE : String(entry.balls),
          entry.notOut ? 'Not out' : dismissalLabel(entry.howOut),
        ],
      })),
      ...(windowed ? [] : [{ key: 'total', total: true, cells: ['Total', `${summary.inningsTotal} innings`, String(summary.runs), '', ''] }]),
    ],
  }

  return (
    <DashboardCard
      testId="runs-per-innings"
      title="Runs per innings"
      subtitle="Batting"
      fullWidth
      dimmed={dimmed}
      empty={empty}
      description={`${summary.inningsTotal} innings, ${summary.notOuts} not out, ${summary.runs} runs.`}
      coverage={caption || null}
      table={table}
      legend={
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <ChartLegend
            label="Runs per innings"
            items={[
              { key: 'out', label: 'Out', style: { tone: 'primary', pattern: 'solid' } },
              { key: 'notOut', label: 'Not out (*)', style: { tone: 'primary', pattern: 'diagonal' } },
              ...(showAverage && average !== null ? [{ key: 'average', label: labelledFigure('Average', average) ?? '', line: { tone: 'grey' as const, dashed: true } }] : []),
            ]}
          />
          {average !== null && <CompactSwitch checked={showAverage} onChange={setShowAverage} label="Show average" />}
        </Box>
      }
    >
      <BarSeriesChart
        labels={innings.map((entry) => shortDate(entry.matchDate))}
        values={innings.map((entry) => entry.runs)}
        hatched={innings.map((entry) => entry.notOut)}
        valueTexts={innings.map((entry, index) => (entry.runs === null ? null : `${entry.runs}${star(index)}`))}
        referenceValue={showAverage ? average : null}
        referenceLabel={labelledFigure('Avg', average)}
        tooltip={(index) => {
          const entry = innings[index]
          if (!entry) return null
          return {
            title: matchTitle(entry.matchDate, entry.opponentName, entry.derby),
            rows: [
              { label: 'Runs', value: entry.runs === null ? NOT_RECORDED : `${entry.runs}${star(index)}` },
              ...(entry.balls === null ? [] : [{ label: 'Balls', value: String(entry.balls) }]),
              { label: 'How out', value: entry.notOut ? 'Not out' : dismissalLabel(entry.howOut) },
            ],
          }
        }}
      />
    </DashboardCard>
  )
}
