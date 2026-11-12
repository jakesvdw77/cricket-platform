import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note, Tiles } from '../../cardParts'
import { dayText, formatCount, formatDecimal, formatPercent } from '../../statsFormat'
import { matchLabel } from '../../teamKit'

// docs/specs/147 Amendment 3, team.bowling-card: the team's bowling at a glance. Front: wickets with the runs conceded, economy, average and
// dot-ball percentage as tiles. Back: every bowling figure as a table and the dot-ball percentage in each match (the dot-ball trend is
// folded in here so the Bowling group keeps even rows). PARTLY: summary results record no dot balls. Source: bowling, series.dotBalls,
// series.dotBallsSummary.
const SHOWN_ROWS = 6

export const teamBowlingCard: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.bowling-card',
  page: 'team',
  group: 'bowling',
  title: () => 'Team Bowling',
  tag: 'PARTLY',
  needs: ['bowling', 'series', 'basis'],
  order: 10,
  whenMissing: 'hide',
  emptyText: 'No bowling recorded yet.',
  basis: (p) => ({ counted: p.bowling.coverage.inningsUsable, total: p.bowling.coverage.inningsCounted }),
  state: (p) => {
    if (p.bowling.wicketsTaken === null && p.bowling.runsConceded === null) return 'empty'
    return p.bowling.coverage.inningsUsable < p.bowling.coverage.inningsCounted || p.series.dotBallsSummary.matchesWithDots < p.series.dotBallsSummary.matchesCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Bowling is recorded in ${p.bowling.coverage.inningsUsable} of ${p.bowling.coverage.inningsCounted} innings, dot balls in ${p.series.dotBallsSummary.matchesWithDots} of ${p.series.dotBallsSummary.matchesCounted} matches.`,
  summary: (p) => `${p.teamName} has taken ${formatCount(p.bowling.wicketsTaken)} wickets at an economy of ${formatDecimal(p.bowling.economy, 2)}.`,
  Front: ({ payload: p }) => (
    <>
      <Big value={formatCount(p.bowling.wicketsTaken)} caption="wickets taken" />
      <Tiles
        dense
        items={[
          { key: 'runs', label: 'Conceded', value: formatCount(p.bowling.runsConceded) },
          { key: 'econ', label: 'Economy', value: formatDecimal(p.bowling.economy, 2) },
          { key: 'avg', label: 'Average', value: formatDecimal(p.bowling.bowlingAverage, 1) },
          { key: 'dots', label: 'Dot balls', value: formatPercent(p.series.dotBallsSummary.averageDotPercent, 0) },
        ]}
      />
    </>
  ),
  Back: ({ payload: p, ctx }) => {
    const { bowling } = p
    const dots = [...p.series.dotBalls].reverse().filter((point) => point.dotPercent !== null)
    return (
      <>
        <Cap>Team bowling</Cap>
        <FaceTable
          label="Team bowling figures"
          heads={['Figure', 'Value']}
          rows={[
            { key: 'wkts', cells: ['Wickets taken', formatCount(bowling.wicketsTaken)] },
            { key: 'runs', cells: ['Runs conceded', formatCount(bowling.runsConceded)] },
            { key: 'balls', cells: ['Balls bowled', formatCount(bowling.ballsBowled)] },
            { key: 'econ', cells: ['Economy', formatDecimal(bowling.economy, 2)] },
            { key: 'avg', cells: ['Average', formatDecimal(bowling.bowlingAverage, 1)] },
            { key: 'dots', cells: ['Dot balls', formatPercent(p.series.dotBallsSummary.averageDotPercent, 1)] },
          ]}
        />
        {dots.length > 0 && (
          <>
            <Cap>Dot-ball percentage by match</Cap>
            <FaceTable
              label="Dot-ball percentage in each match"
              heads={['Match', 'Dots', 'Dot %']}
              rows={dots.slice(0, SHOWN_ROWS).map((point, index) => ({
                key: `${point.matchId}-${index}`,
                cells: [matchLabel(point), formatCount(point.dots), formatPercent(point.dotPercent, 0)],
                href: ctx.resultHref(point.matchId),
                linkName: `Open the match of ${dayText(point.matchDate)}`,
              }))}
            />
            {dots.length > SHOWN_ROWS && <Note>The latest {SHOWN_ROWS} of {dots.length} matches.</Note>}
          </>
        )}
        <Note>Average is runs conceded per wicket taken.</Note>
      </>
    )
  },
}
