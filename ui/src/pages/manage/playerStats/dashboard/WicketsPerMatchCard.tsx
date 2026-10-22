import { DashboardCard } from '../../../../components/DashboardCard'
import { BarSeriesChart } from '../../../../components/charts/BarSeriesChart'
import { formatInstantDate } from '../../../../utils/formatInstantDate'
import { ballsToOvers } from '../../../../utils/oversFormat'
import type { PlayerCardProps } from './RunsPerInningsCard'
import { DashboardResultLink } from '../../results/DashboardResultLink'
import { matchTitle, opponentText, shortDate, windowCaption } from '../../../../utils/dashboardFormat'

// docs/specs/117-stats-dashboard.md (chart 4): Wickets per match, Bowling, full width, the bowling counterpart of Runs per innings. Bars
// for the last 30 matches in which the player bowled with the wickets labelled; economy has its own card. Values are the server's.
export function WicketsPerMatchCard({ data, backTo, dimmed }: PlayerCardProps) {
  const { bowlingMatches: matches, economySummary: summary, wicketTypes, basis } = data
  const windowed = matches.length < summary.totalPoints

  let empty: { title: string; description?: string } | null = null
  if (matches.length === 0) {
    empty =
      basis.resultsWithBowlingCard === 0
        ? { title: 'No bowling cards captured', description: 'No bowling scorecard was captured for these matches.' }
        : { title: 'No bowling to show', description: 'This player did not bowl in these matches.' }
  }

  return (
    <DashboardCard
      testId="wickets-per-match"
      title="Wickets per match"
      subtitle="Bowling"
      fullWidth
      dimmed={dimmed}
      empty={empty}
      description={`${summary.totalPoints} ${summary.totalPoints === 1 ? 'match' : 'matches'} bowled, ${wicketTypes.total} ${wicketTypes.total === 1 ? 'wicket' : 'wickets'}.`}
      coverage={windowCaption(matches.length, summary.totalPoints, 'matches bowled', 'Wickets')}
      table={{
        caption: 'Wickets per match, oldest first',
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'opponent', label: 'Opponent' },
          { key: 'overs', label: 'Overs', align: 'right' },
          { key: 'maidens', label: 'Maidens', align: 'right' },
          { key: 'runs', label: 'Runs', align: 'right' },
          { key: 'wickets', label: 'Wickets', align: 'right' },
        ],
        rows: [
          ...matches.map((match, index) => ({
            key: `${match.resultId}-${index}`,
            cells: [
              <DashboardResultLink key="d" matchId={match.matchId} label={formatInstantDate(match.matchDate)} backTo={backTo} backLabel="Overview" />,
              opponentText(match.opponentName, match.derby),
              ballsToOvers(match.balls, match.ballsPerOver),
              String(match.maidens),
              String(match.runs),
              String(match.wickets),
            ],
          })),
          ...(windowed ? [] : [{ key: 'total', total: true, cells: ['Total', '', '', '', '', String(wicketTypes.total)] }]),
        ],
      }}
    >
      <BarSeriesChart
        labels={matches.map((match) => shortDate(match.matchDate))}
        values={matches.map((match) => match.wickets)}
        tooltip={(index) => {
          const match = matches[index]
          if (!match) return null
          return {
            title: matchTitle(match.matchDate, match.opponentName, match.derby),
            rows: [
              { label: 'Wickets', value: String(match.wickets) },
              { label: 'Overs', value: ballsToOvers(match.balls, match.ballsPerOver) },
              { label: 'Runs', value: String(match.runs) },
              { label: 'Maidens', value: String(match.maidens) },
            ],
          }
        }}
      />
    </DashboardCard>
  )
}
