import { DashboardCard } from '../../../../components/DashboardCard'
import { GroupedBarChart } from '../../../../components/charts/GroupedBarChart'
import { ChartLegend } from '../../../../components/charts/ChartLegend'
import { formatInstantDate } from '../../../../utils/formatInstantDate'
import { NOT_ON_FILE } from '../../../../utils/playerFormat'
import { DashboardResultLink } from '../../playerStats/dashboard/DashboardResultLink'
import { matchTitle, opponentText, shortDate, windowCaption } from '../../playerStats/dashboard/dashboardFormat'
import { FORM_LETTER, FORM_WORD } from '../../leaderboards/teamStatsFormat'
import { resultMarkers } from './teamDashboardParts'
import type { TeamCardProps } from './teamDashboardParts'

// docs/specs/117-stats-dashboard.md (chart 8): Runs scored versus conceded per match, the last 30. Scored solid, conceded hatched, the
// result letter in the axis label; a forfeit or a result without a usable innings is a labelled gap, never a zero. Figures are the server's.
export function RunsScoredCard({ data, backTo, dimmed }: TeamCardProps) {
  const { results, resultsSummary: summary } = data
  const usable = (index: number) => results[index]?.ownRuns !== null && results[index]?.oppRuns !== null

  return (
    <DashboardCard
      testId="runs-scored"
      wide
      title="Runs scored v conceded"
      dimmed={dimmed}
      empty={results.length === 0 ? { title: 'No results to show', description: 'No counted results in these matches.' } : summary.withRuns === 0 ? { title: 'No runs to show', description: 'Runs need results with both innings recorded.' } : null}
      description={`${summary.shown} ${summary.shown === 1 ? 'result' : 'results'} shown, ${summary.withRuns} with runs recorded on both sides.`}
      coverage={[windowCaption(results.length, summary.totalPoints, 'results', 'Played'), summary.withRuns < results.length ? `Runs shown for ${summary.withRuns} of ${results.length} results.` : null].filter(Boolean).join(' ') || null}
      legend={
        <ChartLegend
          label="Runs scored versus conceded"
          items={[
            { key: 'scored', label: 'Scored', style: { tone: 'primary', pattern: 'solid' } },
            { key: 'conceded', label: 'Conceded', style: { tone: 'error', pattern: 'diagonal' } },
            { key: 'letters', label: 'Letter: W won, L lost, T tied, D drawn, NR no result' },
          ]}
        />
      }
      table={{
        caption: 'Runs scored and conceded per result, oldest first',
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'opponent', label: 'Opponent' },
          { key: 'result', label: 'Result' },
          { key: 'scored', label: 'Scored', align: 'right' },
          { key: 'conceded', label: 'Conceded', align: 'right' },
        ],
        rows: results.map((result, index) => ({
          key: `${result.resultId}-${index}`,
          cells: [
            <DashboardResultLink key="d" matchId={result.matchId} label={formatInstantDate(result.matchDate)} backTo={backTo} backLabel="Team" />,
            opponentText(result.opponentName, result.derby),
            [FORM_WORD[result.result], ...resultMarkers(result)].join(' · '),
            result.ownRuns === null ? NOT_ON_FILE : `${result.ownRuns}${result.ownWickets === null ? '' : `/${result.ownWickets}`}`,
            result.oppRuns === null ? NOT_ON_FILE : `${result.oppRuns}${result.oppWickets === null ? '' : `/${result.oppWickets}`}`,
          ],
        })),
      }}
    >
      <GroupedBarChart
        labels={results.map((result) => `${shortDate(result.matchDate)} ${FORM_LETTER[result.result]}`)}
        gapTexts={results.map((result, index) => (result.forfeit ? 'forfeit' : usable(index) ? null : 'n/r'))}
        series={[
          { key: 'scored', label: 'Scored', style: { tone: 'primary', pattern: 'solid' }, values: results.map((result) => result.ownRuns) },
          { key: 'conceded', label: 'Conceded', style: { tone: 'error', pattern: 'diagonal' }, values: results.map((result) => result.oppRuns) },
        ]}
        tooltip={(index) => {
          const result = results[index]
          if (!result) return null
          return {
            title: matchTitle(result.matchDate, result.opponentName, result.derby),
            rows: [
              { label: 'Result', value: [FORM_WORD[result.result], ...resultMarkers(result)].join(' · ') },
              { label: 'Scored', value: result.ownRuns === null ? NOT_ON_FILE : String(result.ownRuns) },
              { label: 'Conceded', value: result.oppRuns === null ? NOT_ON_FILE : String(result.oppRuns) },
            ],
          }
        }}
      />
    </DashboardCard>
  )
}
