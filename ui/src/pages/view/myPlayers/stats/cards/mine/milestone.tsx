import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { ProgressBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import type { TableRowSpec } from '../../cardParts'
import { BRAND, STATS_COLOUR } from '../../../../../../brandTokens'
import type { MyStatsMilestone } from '../../../../../../api/meStatsApi'
import { formatDecimal, plural, scoreText, wicketsForRuns } from '../../statsFormat'

// Amendment 2 item 19: the bar's colour is how close the milestone is (display classification of the server's numbers, no new statistic).
export const MILESTONE_AMBER_FROM = 0.5
export const MILESTONE_GREEN_FROM = 0.8

function milestoneRow(key: string, label: string, m: MyStatsMilestone) {
  // Reached: a full gold bar and 'Done' (gold is the answer); the server then names the next ladder step, which starts as a new grey bar.
  if (m.target > 0 && m.current >= m.target) return { key, label, value: m.target, target: m.target, text: 'Done', colour: BRAND.gold }
  const fraction = m.target > 0 ? m.current / m.target : 0
  const colour = fraction >= MILESTONE_GREEN_FROM ? STATS_COLOUR.good : fraction >= MILESTONE_AMBER_FROM ? STATS_COLOUR.amber : STATS_COLOUR.neutralGrey
  return { key, label, value: m.current, target: m.target, text: `${m.toGo} to go`, colour }
}

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
            milestoneRow('runs', `${runs.target} runs`, runs),
            milestoneRow('wickets', `${wickets.target} wickets`, wickets),
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
