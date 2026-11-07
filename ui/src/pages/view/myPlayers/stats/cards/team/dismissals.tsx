import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { Donut } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { STATS_COLOUR } from '../../../../../../brandTokens'
import { Cap, FaceTable, Note } from '../../cardParts'
import { batterDismissalColour } from '../../dismissalColours'
import { NOT_RECORDED, formatPercent, nOfM, need } from '../../statsFormat'

// docs/specs/147 Amendment 3, team.dismissals: how the team's batters get out (a donut in the Player Stats dismissal colours). Back: the
// types as a table with the not outs. Source: dismissals.
export const teamDismissals: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.dismissals',
  page: 'team',
  group: 'batting',
  title: (ctx) => `How ${ctx.teamName ?? 'The Team'} Gets Out`,
  tag: 'PARTLY',
  needs: ['dismissals', 'basis'],
  order: 30,
  whenMissing: 'notCaptured',
  emptyText: 'No wickets lost yet.',
  missingText: 'The way batters got out is not recorded for these results.',
  basis: (p) => ({ counted: need(p.dismissals).coverage.recorded, total: need(p.dismissals).coverage.counted }),
  state: (p) => {
    if (!p.dismissals) return 'missing'
    if (p.dismissals.wickets === 0) return p.dismissals.coverage.recorded === 0 && p.dismissals.coverage.counted > 0 ? 'missing' : 'empty'
    if (p.dismissals.types.length === 0) return 'missing'
    return p.dismissals.notRecorded > 0 || p.dismissals.coverage.recorded < p.dismissals.coverage.counted ? 'partial' : 'ready'
  },
  partialNote: (p) => `The way out is recorded for ${nOfM(need(p.dismissals).wickets - need(p.dismissals).notRecorded, need(p.dismissals).wickets)} wickets.`,
  summary: (p) => `How ${p.teamName}'s batters were out over ${need(p.dismissals).wickets} wickets: ${need(p.dismissals).types.map((slice) => `${slice.label} ${slice.count}`).join(', ')}.`,
  Front: ({ payload: p }) => {
    const slices = [
      ...need(p.dismissals).types.map((slice) => ({ key: slice.type, label: slice.label, value: slice.count, colour: batterDismissalColour(slice.type) })),
      ...(need(p.dismissals).notRecorded > 0 ? [{ key: 'not-recorded', label: NOT_RECORDED, value: need(p.dismissals).notRecorded, colour: STATS_COLOUR.neutralGrey }] : []),
    ]
    return (
      <>
        <Donut
          alt={`How ${p.teamName}'s batters were out: ${slices.map((slice) => `${slice.label} ${slice.value}`).join(', ')}.`}
          centre={String(need(p.dismissals).wickets)}
          centreCaption="wickets"
          slices={slices}
        />
        <Note>{need(p.dismissals).notOut} {need(p.dismissals).notOut === 1 ? 'batter' : 'batters'} finished not out.</Note>
      </>
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>How the batters were out</Cap>
      <FaceTable
        label="Dismissal types with counts and shares"
        heads={['How', 'Wickets', 'Share']}
        rows={[
          ...need(p.dismissals).types.map((slice) => ({ key: slice.type, cells: [slice.label, String(slice.count), formatPercent(slice.percent, 0)] })),
          ...(need(p.dismissals).notRecorded > 0 ? [{ key: 'not-recorded', cells: [NOT_RECORDED, String(need(p.dismissals).notRecorded), '–'] }] : []),
          { key: 'not-out', cells: ['Not out', String(need(p.dismissals).notOut), '–'] },
        ]}
      />
      <Note>Shares are of all batters, not outs included. Recorded for {nOfM(need(p.dismissals).coverage.recorded, need(p.dismissals).coverage.counted)} innings.</Note>
    </>
  ),
}
