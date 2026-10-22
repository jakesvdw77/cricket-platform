import { DashboardCard } from '../../../../components/DashboardCard'
import { BarSeriesChart } from '../../../../components/charts/BarSeriesChart'
import { formatInstantDate } from '../../../../utils/formatInstantDate'
import { DashboardResultLink } from '../../results/DashboardResultLink'
import { figureOrNotRecorded, figureOrNull, labelledFigure, percentOrNotRecorded, matchTitle, opponentText, shortDate, trendSentence, windowCaption } from '../../../../utils/dashboardFormat'
import type { TeamCardProps } from './teamDashboardParts'

// docs/specs/117-stats-dashboard.md (chart 11, decision 15b): Dot balls, simple bars of the dot-ball percentage per match on one 0 to 100 scale,
// a dashed reference at the pooled average, "Higher is better", a gap where dots were not recorded for every bowler of the innings and the
// server's trend sentence underneath. Figures are the server's.
export function DotBallsCard({ data, backTo, dimmed }: TeamCardProps) {
  const points = data.dotBalls
  const summary = data.dotBallsSummary
  const average = summary.averageDotPercent
  const trend = trendSentence({ recent: summary.recentAverage, earlier: summary.earlierAverage, direction: summary.direction }, 'dots')

  return (
    <DashboardCard
      testId="dot-balls"
      wide
      title="Dot balls"
      dimmed={dimmed}
      empty={summary.matchesWithDots === 0 ? { title: 'No dot balls have been recorded for these matches.', description: 'Dot balls are optional on the bowling card; enter them on a result to see this chart.' } : null}
      note="Higher is better"
      description={average === null ? `Dot balls recorded for ${summary.matchesWithDots} of ${summary.matchesCounted} matches.` : `Dot balls recorded for ${summary.matchesWithDots} of ${summary.matchesCounted} matches; ${labelledFigure('average', average, 1)}%.`}
      footer={trend}
      coverage={[summary.matchesWithDots < summary.matchesCounted ? `Dot balls recorded for ${summary.matchesWithDots} of ${summary.matchesCounted} matches.` : null, windowCaption(points.length, summary.totalPoints, 'matches', 'Played')].filter(Boolean).join(' ') || null}
      table={{
        caption: 'Dot balls per match, oldest first',
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'opponent', label: 'Opponent' },
          { key: 'balls', label: 'Balls bowled', align: 'right' },
          { key: 'dots', label: 'Dot balls', align: 'right' },
          { key: 'percent', label: 'Dot %', align: 'right' },
        ],
        rows: points.map((point, index) => ({
          key: `${point.resultId}-${index}`,
          cells: [
            <DashboardResultLink key="d" matchId={point.matchId} label={formatInstantDate(point.matchDate)} backTo={backTo} backLabel="Team" />,
            opponentText(point.opponentName, point.derby),
            figureOrNotRecorded(point.ballsBowled),
            figureOrNotRecorded(point.dots),
            percentOrNotRecorded(point.dotPercent),
          ],
        })),
      }}
    >
      <BarSeriesChart
        labels={points.map((point) => shortDate(point.matchDate))}
        values={points.map((point) => point.dotPercent)}
        valueTexts={points.map((point) => figureOrNull(point.dotPercent, 1))}
        max={100}
        referenceValue={average}
        referenceLabel={labelledFigure('Average', average, 1) && `${labelledFigure('Average', average, 1)}%`}
        tooltip={(index) => {
          const point = points[index]
          if (!point) return null
          return {
            title: matchTitle(point.matchDate, point.opponentName, point.derby),
            rows: [
              { label: 'Dot %', value: percentOrNotRecorded(point.dotPercent) },
              { label: 'Dot balls', value: figureOrNotRecorded(point.dots) },
              { label: 'Balls bowled', value: figureOrNotRecorded(point.ballsBowled) },
            ],
          }
        }}
      />
    </DashboardCard>
  )
}
