import { DashboardCard } from '../../../../components/DashboardCard'
import { LineSeriesChart } from '../../../../components/charts/LineSeriesChart'
import { ChartLegend } from '../../../../components/charts/ChartLegend'
import { formatInstantDate } from '../../../../utils/formatInstantDate'
import { ballsToOvers } from '../../../../utils/oversFormat'
import type { PlayerCardProps } from './RunsPerInningsCard'
import { DashboardResultLink } from '../../results/DashboardResultLink'
import { figureOrNotRecorded, figureOrNull, labelledFigure, matchTitle, opponentText, shortDate, trendSentence } from '../../../../utils/dashboardFormat'

// docs/specs/117-stats-dashboard.md (chart 6, decision 20): Economy rate, Bowling, half width, the bowling counterpart of Batting trend.
// One line per match (last 30 in which the player bowled) with a dashed reference at the overall economy (equal to the Bowling tab's
// Econ), "Lower is better", the server's trend sentence and gaps where economy is undefined. Every value is the server's.
export function EconomyRateCard({ data, backTo, dimmed }: PlayerCardProps) {
  const { bowlingMatches: matches, economySummary: summary, basis } = data
  const overall = summary.overallEconomy

  let empty: { title: string; description?: string } | null = null
  if (matches.length === 0) {
    empty =
      basis.resultsWithBowlingCard === 0
        ? { title: 'No bowling cards captured', description: 'No bowling scorecard was captured for these matches.' }
        : { title: 'No bowling to show', description: 'This player did not bowl in these matches.' }
  } else if (summary.matchesWithEconomy === 0) {
    empty = { title: 'No economy rate for this player', description: 'Economy cannot be shown: no balls bowled in these matches.' }
  }

  const trend = trendSentence({ recent: summary.recentEconomy, earlier: summary.earlierEconomy, direction: summary.direction }, 'economy')
  const values = matches.map((match) => match.economy)

  return (
    <DashboardCard
      testId="economy-rate"
      wide
      title="Economy rate"
      subtitle="Bowling"
      dimmed={dimmed}
      empty={empty}
      note="Lower is better · runs per over"
      description={labelledFigure('Overall economy', overall) && `${labelledFigure('Overall economy', overall)} runs per over over ${summary.totalPoints} ${summary.totalPoints === 1 ? 'match' : 'matches'}.`}
      footer={trend}
      coverage={summary.matchesWithEconomy < summary.matchesCounted ? `Economy shown for ${summary.matchesWithEconomy} of ${summary.matchesCounted} matches.` : null}
      legend={
        <ChartLegend
          label="Economy rate"
          items={[
            { key: 'economy', label: 'Economy per match', line: { tone: 'info', marker: 'circle' } },
            ...(overall === null ? [] : [{ key: 'overall', label: labelledFigure('Overall', overall) ?? '', line: { tone: 'grey' as const, dashed: true } }]),
          ]}
        />
      }
      table={{
        caption: 'Economy rate per match, oldest first',
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'opponent', label: 'Opponent' },
          { key: 'overs', label: 'Overs', align: 'right' },
          { key: 'runs', label: 'Runs', align: 'right' },
          { key: 'wickets', label: 'Wickets', align: 'right' },
          { key: 'econ', label: 'Econ', align: 'right' },
        ],
        rows: matches.map((match, index) => ({
          key: `${match.resultId}-${index}`,
          cells: [
            <DashboardResultLink key="d" matchId={match.matchId} label={formatInstantDate(match.matchDate)} backTo={backTo} backLabel="Overview" />,
            opponentText(match.opponentName, match.derby),
            ballsToOvers(match.balls, match.ballsPerOver),
            String(match.runs),
            String(match.wickets),
            figureOrNotRecorded(match.economy, 2),
          ],
        })),
      }}
    >
      <LineSeriesChart
        labels={matches.map((match) => shortDate(match.matchDate))}
        series={[{ key: 'economy', label: 'Economy', tone: 'info', marker: 'circle', values, pointTexts: matches.length <= 12 ? values.map((value) => figureOrNull(value, 2)) : undefined }]}
        referenceValue={overall}
        referenceLabel={labelledFigure('Average', overall)}
        tooltip={(index) => {
          const match = matches[index]
          if (!match) return null
          return {
            title: matchTitle(match.matchDate, match.opponentName, match.derby),
            rows: [
              { label: 'Economy', value: figureOrNotRecorded(match.economy, 2) },
              { label: 'Overs', value: ballsToOvers(match.balls, match.ballsPerOver) },
              { label: 'Runs', value: String(match.runs) },
              { label: 'Wickets', value: String(match.wickets) },
            ],
          }
        }}
      />
    </DashboardCard>
  )
}
