import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { ProgressBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import type { TableRowSpec } from '../../cardParts'
import { formatDecimal, plural, scoreText, wicketsForRuns } from '../../statsFormat'

// docs/specs/147 section 5, mine.milestone: progress to the next round number for runs and wickets, with the matches left in the fixture list.
// Back: personal bests, each opening its match. Source: milestones, basis.fixturesRemaining.
export const mineMilestone: StatsCardDef<MyStatsDto> = {
  id: 'mine.milestone',
  page: 'mine',
  group: 'batting',
  title: () => 'Next milestone',
  tag: 'HAVE',
  needs: ['milestones', 'basis'],
  order: 60,
  whenMissing: 'hide',
  emptyText: 'No runs or wickets yet.',
  basis: (p) => ({ counted: p.basis.resultsCounted, total: p.basis.resultsCounted }),
  state: (p) => (p.milestones.runs.current === 0 && p.milestones.wickets.current === 0 ? 'empty' : 'ready'),
  summary: (p, ctx) => `${ctx.firstName} needs ${p.milestones.runs.toGo} more runs to reach ${p.milestones.runs.target} and ${p.milestones.wickets.toGo} more wickets to reach ${p.milestones.wickets.target}.`,
  Front: ({ payload: p }) => {
    const { runs, wickets } = p.milestones
    return (
      <>
        <ProgressBars
          alt={`Progress to the next milestones: ${runs.current} of ${runs.target} runs, ${wickets.current} of ${wickets.target} wickets.`}
          rows={[
            { key: 'runs', label: `${runs.target} runs`, value: runs.current, target: runs.target, text: `${runs.toGo} to go` },
            { key: 'wickets', label: `${wickets.target} wickets`, value: wickets.current, target: wickets.target, text: `${wickets.toGo} to go` },
          ]}
        />
        <Note>
          {runs.current} of {runs.target} runs and {wickets.current} of {wickets.target} wickets
          {p.basis.fixturesRemaining !== null ? `, ${plural(p.basis.fixturesRemaining, 'match', 'matches')} left in the fixture list` : ''}.
        </Note>
      </>
    )
  },
  Back: ({ payload: p, ctx }) => {
    const best = p.milestones.personalBests
    const rows: TableRowSpec[] = []
    if (best.highestScore) rows.push({ key: 'hs', cells: ['Highest score', scoreText(best.highestScore.runs, best.highestScore.notOut)], href: ctx.resultHref(best.highestScore.matchId), linkName: 'Open the match of the highest score' })
    if (best.bestBowling) rows.push({ key: 'bb', cells: ['Best bowling', wicketsForRuns(best.bestBowling.wickets, best.bestBowling.runs)], href: ctx.resultHref(best.bestBowling.matchId), linkName: 'Open the match of the best bowling' })
    if (best.mostCatches) rows.push({ key: 'mc', cells: ['Most catches', String(best.mostCatches.catches)], href: ctx.resultHref(best.mostCatches.matchId), linkName: 'Open the match with the most catches' })
    if (best.bestStrikeRate) rows.push({ key: 'sr', cells: ['Best strike rate', formatDecimal(best.bestStrikeRate.strikeRate, 1)], href: ctx.resultHref(best.bestStrikeRate.matchId), linkName: 'Open the match of the best strike rate' })
    return (
      <>
        <Cap>Personal bests</Cap>
        {rows.length === 0 ? <Note>No personal bests in this scope yet.</Note> : <FaceTable label="Personal bests" heads={['Best', 'Figure']} rows={rows} />}
        <Note>Best strike rate counts innings of at least {best.minimumBalls} balls faced. Tap a row to open that match.</Note>
      </>
    )
  },
}
